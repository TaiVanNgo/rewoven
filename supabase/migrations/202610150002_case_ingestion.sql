create function public.reserve_case(p_id uuid, p_session uuid, p_input jsonb, p_source jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.cases(id, session_id, request_key, title, context, outcome, lessons)
  values(p_id, p_session, p_id, p_input->>'title', p_input->>'context', p_input->>'outcome', p_input->>'lessons')
  on conflict (id) do nothing;
  if not found then return false; end if;
  insert into public.source_documents(id, case_id, title, format, original_text, storage_path)
  values(p_id, p_id, p_source->>'title', p_source->>'format', p_source->>'original_text', p_source->>'storage_path');
  return true;
end;
$$;

create function public.claim_case(p_id uuid, p_session uuid, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.cases set status = 'processing', error_message = null,
    processing_started_at = now(), processing_token = p_token
  where id = p_id and session_id = p_session and not is_seed and (
    status = 'failed' or (status = 'processing' and (processing_token is null or processing_started_at < now() - interval '2 minutes'))
  );
  return found;
end;
$$;

create function public.finish_case(p_id uuid, p_token uuid, p_text text, p_pages jsonb, p_warnings jsonb, p_chunks jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_source_id uuid;
begin
  perform 1 from public.cases where id = p_id and processing_token = p_token and status = 'processing' for update;
  if not found then return false; end if;
  select id into v_source_id from public.source_documents where case_id = p_id;
  update public.source_documents set extracted_text = p_text, pages = p_pages, warnings = p_warnings where id = v_source_id;
  delete from public.source_chunks where source_chunks.source_id = v_source_id;
  insert into public.source_chunks(source_id, ordinal, page_number, char_start, char_end, text)
  select v_source_id, x.ordinal, x.page_number, x.char_start, x.char_end, x.text
  from jsonb_to_recordset(p_chunks) as x(ordinal integer, page_number integer, char_start integer, char_end integer, text text);
  update public.cases set status = 'ready', error_message = null, processing_token = null where id = p_id;
  return true;
end;
$$;

revoke execute on function public.reserve_case(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.claim_case(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.finish_case(uuid, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_case(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.claim_case(uuid, uuid, uuid) to service_role;
grant execute on function public.finish_case(uuid, uuid, text, jsonb, jsonb, jsonb) to service_role;
