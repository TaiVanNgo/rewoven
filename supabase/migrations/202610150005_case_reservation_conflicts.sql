-- Concurrent retries can collide on either cases.id or (session_id, request_key).
-- Handle both unique constraints; the API still checks ownership when reusing a case.
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
  on conflict do nothing;
  if not found then return false; end if;
  insert into public.source_documents(id, case_id, title, format, original_text, storage_path)
  values(p_id, p_id, p_source->>'title', p_source->>'format', p_source->>'original_text', p_source->>'storage_path');
  if v_reading is not null then
    insert into public.case_ai_reviews(case_id, source_id, reading_id) values(p_id, p_id, v_reading);
  end if;
  return true;
end;
$$;
