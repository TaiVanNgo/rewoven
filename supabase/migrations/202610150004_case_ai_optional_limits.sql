-- Development passes NULL for both attempt limits. Production passes finite limits.
-- Keep session expiry, atomic reservations, processing leases, and attempt history.
-- CREATE OR REPLACE preserves the existing service_role-only execution grants.
create or replace function public.reserve_case_ai_reading(
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
  -- NULL means unlimited; zero still blocks new reservations.
  if p_session_limit is not null and
    (select count(*) from public.case_ai_attempts where session_id = p_session) >= p_session_limit then
    return jsonb_build_object('state', 'session_limit');
  end if;
  v_day := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if p_daily_limit is not null and
    (select count(*) from public.case_ai_attempts where started_at >= v_day) >= p_daily_limit then
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
