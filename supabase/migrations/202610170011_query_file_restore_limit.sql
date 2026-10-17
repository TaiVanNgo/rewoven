create or replace function public.toggle_query_file(p_session uuid,p_id uuid,p_enabled boolean,p_revision integer)
returns void language plpgsql security invoker set search_path='' as $$
declare v_conversation uuid;
begin
  select conversation_id into v_conversation from public.query_files where id=p_id and session_id=p_session;
  perform 1 from public.query_conversations q join public.demo_sessions s on s.id=q.session_id where q.id=v_conversation and q.session_id=p_session and q.context_revision=p_revision and s.expires_at>now() for update of q;
  if not found then raise exception 'Document: Chat changed. Reopen it and try again.'; end if;
  if exists(select 1 from public.query_turns where conversation_id=v_conversation and status='processing' and started_at>now()-interval '5 minutes') then raise exception 'Document: Wait for Wren to finish.'; end if;
  if p_enabled and exists(select 1 from public.query_files where id=p_id and first_turn_id is null and not enabled)
    and (select count(*) from public.query_files where conversation_id=v_conversation and first_turn_id is null and enabled)>=5 then raise exception 'Document: Send or exclude the pending files before restoring another.'; end if;
  update public.query_files set enabled=p_enabled where id=p_id;
  update public.query_conversations set context_revision=context_revision+1 where id=v_conversation;
end;
$$;
