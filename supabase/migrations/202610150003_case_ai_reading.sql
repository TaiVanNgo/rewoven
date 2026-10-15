create table public.case_ai_readings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.demo_sessions(id) on delete cascade,
  source_hash text not null,
  model text not null,
  prompt_version integer not null,
  status text not null check (status in ('processing', 'ready', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  processing_token uuid,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  result jsonb,
  unique (session_id, source_hash, model, prompt_version),
  check (status <> 'ready' or (result is not null and processing_token is null))
);
-- Separate attempt timestamps enforce a global UTC-day limit across retries and sessions.
create table public.case_ai_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.demo_sessions(id) on delete cascade,
  reading_id uuid not null references public.case_ai_readings(id) on delete cascade,
  started_at timestamptz not null default now()
);
create index case_ai_attempts_day_idx on public.case_ai_attempts(started_at);
create index case_ai_attempts_session_idx on public.case_ai_attempts(session_id);
create table public.case_ai_reviews (
  case_id uuid primary key references public.cases(id) on delete cascade,
  source_id uuid not null references public.source_documents(id) on delete cascade,
  reading_id uuid not null references public.case_ai_readings(id),
  created_at timestamptz not null default now()
);
alter table public.case_ai_readings enable row level security;
alter table public.case_ai_attempts enable row level security;
alter table public.case_ai_reviews enable row level security;
revoke all on public.case_ai_readings, public.case_ai_attempts, public.case_ai_reviews from public, anon, authenticated;
grant select, insert, update, delete on public.case_ai_readings, public.case_ai_attempts, public.case_ai_reviews to service_role;

create function public.protect_case_ai_reading()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'ready' then raise exception 'Completed AI readings are immutable'; end if;
  return new;
end;
$$;
create trigger immutable_completed_ai_reading before update on public.case_ai_readings
  for each row execute function public.protect_case_ai_reading();
revoke execute on function public.protect_case_ai_reading() from public, anon, authenticated;

create function public.reserve_case_ai_reading(
  p_session uuid, p_hash text, p_model text, p_version integer, p_token uuid,
  p_session_limit integer, p_daily_limit integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_read public.case_ai_readings; v_day timestamptz;
begin
  -- All workers reserve budget in one short transaction before any provider call.
  perform pg_advisory_xact_lock(hashtextextended('rewoven.case-ai-budget', 0));
  if not exists (select 1 from public.demo_sessions where id = p_session and expires_at > now()) then
    return jsonb_build_object('state', 'expired');
  end if;
  select * into v_read from public.case_ai_readings
    where session_id = p_session and source_hash = p_hash and model = p_model and prompt_version = p_version;
  if found and v_read.status = 'ready' then
    return jsonb_build_object('state', 'cached', 'id', v_read.id, 'result', v_read.result);
  end if;
  if exists (select 1 from public.case_ai_readings where session_id = p_session and status = 'processing' and started_at > now() - interval '2 minutes') then
    return jsonb_build_object('state', 'busy');
  end if;
  if p_session_limit < 0 or p_daily_limit < 0 then raise exception 'Invalid AI limits'; end if;
  if (select count(*) from public.case_ai_attempts where session_id = p_session) >= p_session_limit then
    return jsonb_build_object('state', 'session_limit');
  end if;
  v_day := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if (select count(*) from public.case_ai_attempts where started_at >= v_day) >= p_daily_limit then
    return jsonb_build_object('state', 'daily_limit');
  end if;
  insert into public.case_ai_readings(session_id, source_hash, model, prompt_version, status, processing_token)
    values(p_session, p_hash, p_model, p_version, 'processing', p_token)
    on conflict(session_id, source_hash, model, prompt_version) do update set
      status = 'processing', processing_token = p_token, started_at = now(),
      attempts = public.case_ai_readings.attempts + 1, result = null
    returning * into v_read;
  insert into public.case_ai_attempts(session_id, reading_id) values(p_session, v_read.id);
  return jsonb_build_object('state', 'reserved', 'id', v_read.id);
end;
$$;
revoke execute on function public.reserve_case_ai_reading(uuid, text, text, integer, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_case_ai_reading(uuid, text, text, integer, uuid, integer, integer) to service_role;

-- Keep the existing signature and manual submissions compatible; attach the review atomically.
create or replace function public.reserve_case(p_id uuid, p_session uuid, p_input jsonb, p_source jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_reading uuid;
begin
  if p_source->>'ai_reading_id' is not null then
    select id into v_reading from public.case_ai_readings
      where id = (p_source->>'ai_reading_id')::uuid and session_id = p_session
        and source_hash = p_source->>'source_hash' and status = 'ready';
    if not found then raise exception 'AI reading does not match this session and source'; end if;
  end if;
  insert into public.cases(id, session_id, request_key, title, context, outcome, lessons)
  values(p_id, p_session, p_id, p_input->>'title', p_input->>'context', p_input->>'outcome', p_input->>'lessons')
  on conflict (id) do nothing;
  if not found then return false; end if;
  insert into public.source_documents(id, case_id, title, format, original_text, storage_path)
  values(p_id, p_id, p_source->>'title', p_source->>'format', p_source->>'original_text', p_source->>'storage_path');
  if v_reading is not null then
    insert into public.case_ai_reviews(case_id, source_id, reading_id) values(p_id, p_id, v_reading);
  end if;
  return true;
end;
$$;
