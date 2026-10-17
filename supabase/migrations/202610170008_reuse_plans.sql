create table public.reuse_plans (
  id uuid primary key,
  session_id uuid not null references public.demo_sessions(id) on delete cascade,
  conversation_id uuid not null references public.query_conversations(id) on delete cascade,
  title text not null check(length(title) between 1 and 120),
  snapshot jsonb not null,
  brief jsonb,
  confirmed_request jsonb,
  status text not null default 'preparing' check(status in ('preparing','review','generating','ready','failed')),
  failed_stage text check(failed_stage in ('prepare','generate')),
  kind text not null default 'reuse' check(kind in ('reuse','clarification')),
  evidence jsonb not null default '[]',
  warnings jsonb not null default '[]',
  generated jsonb,
  generated_markdown text,
  saved_markdown text check(length(saved_markdown) between 1 and 50000),
  saved_title text check(length(saved_title) between 1 and 120),
  revision integer not null default 0,
  saved_at timestamptz,
  error_message text,
  processing_token uuid,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index reuse_plans_session_idx on public.reuse_plans(session_id,saved_at desc);
create index reuse_plans_conversation_idx on public.reuse_plans(conversation_id,created_at desc);
create table public.plan_ai_attempts (
  id uuid primary key,
  session_id uuid not null references public.demo_sessions(id) on delete cascade,
  plan_id uuid not null references public.reuse_plans(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index plan_attempts_session_idx on public.plan_ai_attempts(session_id);
create index plan_attempts_created_idx on public.plan_ai_attempts(created_at);
alter table public.reuse_plans enable row level security;
alter table public.plan_ai_attempts enable row level security;
revoke all on public.reuse_plans,public.plan_ai_attempts from anon,authenticated;
grant all on public.reuse_plans,public.plan_ai_attempts to service_role;

create function public.create_reuse_plan(p_session uuid,p_conversation uuid,p_id uuid,p_revision integer,p_snapshot jsonb)
returns text language plpgsql security invoker set search_path='' as $$
declare v_plan public.reuse_plans; v_revision integer;
begin
  select * into v_plan from public.reuse_plans where id=p_id;
  if found then
    if v_plan.session_id=p_session and v_plan.conversation_id=p_conversation and exists(select 1 from public.demo_sessions where id=p_session and expires_at>now()) then return 'cached'; end if;
    return 'conflict';
  end if;
  select context_revision into v_revision from public.query_conversations q join public.demo_sessions s on s.id=q.session_id
    where q.id=p_conversation and q.session_id=p_session and s.expires_at>now() for update of q;
  if not found then return 'missing'; end if;
  if v_revision<>p_revision then return 'context_changed'; end if;
  if exists(select 1 from public.query_turns where conversation_id=p_conversation and status='processing' and started_at>now()-interval '5 minutes') then return 'busy'; end if;
  if (select id::text from public.query_turns where conversation_id=p_conversation order by ordinal desc limit 1) is distinct from (p_snapshot->>'throughTurnId') then return 'context_changed'; end if;
  insert into public.reuse_plans(id,session_id,conversation_id,title,snapshot)
    values(p_id,p_session,p_conversation,'New reuse plan',p_snapshot) on conflict(id) do nothing;
  select * into v_plan from public.reuse_plans where id=p_id;
  if v_plan.session_id<>p_session or v_plan.conversation_id<>p_conversation then return 'conflict'; end if;
  return 'created';
end;
$$;

create function public.claim_plan_operation(p_session uuid,p_id uuid,p_stage text,p_token uuid,p_request jsonb default null)
returns text language plpgsql security invoker set search_path='' as $$
declare v_plan public.reuse_plans;
begin
  select p.* into v_plan from public.reuse_plans p join public.demo_sessions s on s.id=p.session_id
    where p.id=p_id and p.session_id=p_session and s.expires_at>now() for update of p;
  if not found then return 'missing'; end if;
  if p_stage not in ('prepare','generate') then return 'conflict'; end if;
  if p_stage='prepare' and v_plan.brief is not null then return 'cached'; end if;
  if p_stage='generate' then
    if v_plan.confirmed_request is not null and v_plan.confirmed_request is distinct from p_request then return 'conflict'; end if;
    if v_plan.status='ready' then return 'cached'; end if;
    if v_plan.brief is null or p_request is null then return 'conflict'; end if;
  end if;
  if v_plan.processing_token is not null and v_plan.started_at>now()-interval '5 minutes' then return 'busy'; end if;
  update public.reuse_plans set status=case when p_stage='prepare' then 'preparing' else 'generating' end,
    processing_token=p_token,started_at=now(),failed_stage=p_stage,error_message=null,
    confirmed_request=case when p_stage='generate' then p_request else confirmed_request end,
    title=case when p_stage='generate' then p_request->>'title' else title end where id=p_id;
  return 'claimed';
end;
$$;
create function public.reserve_plan_ai(p_session uuid,p_plan uuid,p_token uuid,p_session_limit integer,p_daily_limit integer)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('rewoven.plan-ai-budget',0));
  if not exists(select 1 from public.reuse_plans p join public.demo_sessions s on s.id=p.session_id where p.id=p_plan and p.session_id=p_session and p.processing_token=p_token and s.expires_at>now()) then return false; end if;
  if exists(select 1 from public.plan_ai_attempts where id=p_token) then return true; end if;
  if p_session_limit<0 or p_daily_limit<0 then raise exception 'Invalid plan limits'; end if;
  if p_session_limit is not null and (select count(*) from public.plan_ai_attempts where session_id=p_session)>=p_session_limit then return false; end if;
  if p_daily_limit is not null and (select count(*) from public.plan_ai_attempts where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=p_daily_limit then return false; end if;
  insert into public.plan_ai_attempts(id,session_id,plan_id) values(p_token,p_session,p_plan);
  return true;
end;
$$;
create function public.save_reuse_plan(p_session uuid,p_plan uuid,p_revision integer,p_title text,p_markdown text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.reuse_plans p set saved_title=p_title,saved_markdown=p_markdown,revision=revision+1,saved_at=now()
    where p.id=p_plan and p.session_id=p_session and p.status='ready' and p.revision=p_revision
    and exists(select 1 from public.demo_sessions where id=p_session and expires_at>now());
  return found;
end;
$$;
revoke execute on function public.create_reuse_plan(uuid,uuid,uuid,integer,jsonb),public.claim_plan_operation(uuid,uuid,text,uuid,jsonb),public.reserve_plan_ai(uuid,uuid,uuid,integer,integer),public.save_reuse_plan(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.create_reuse_plan(uuid,uuid,uuid,integer,jsonb),public.claim_plan_operation(uuid,uuid,text,uuid,jsonb),public.reserve_plan_ai(uuid,uuid,uuid,integer,integer),public.save_reuse_plan(uuid,uuid,integer,text,text) to service_role;
