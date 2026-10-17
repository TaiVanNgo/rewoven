create table public.query_files (
  id uuid primary key,
  conversation_id uuid not null references public.query_conversations(id) on delete cascade,
  session_id uuid not null references public.demo_sessions(id) on delete cascade,
  title text not null check(length(title) between 1 and 200),
  format text not null check(format in ('txt','md','pdf')),
  version integer not null default 1 check(version=1),
  storage_path text not null unique,
  byte_size integer not null check(byte_size between 1 and 5000000),
  char_count integer not null default 0 check(char_count between 0 and 500000),
  status text not null default 'uploading' check(status in ('uploading','extracting','reading','ready','failed')),
  enabled boolean not null default true,
  first_turn_id uuid references public.query_turns(id),
  pages jsonb not null default '[]',
  warnings jsonb not null default '[]',
  nodes jsonb not null default '[]',
  cursor integer not null default 0,
  total integer not null default 0,
  error_message text,
  processing_token uuid,
  started_at timestamptz,
  created_at timestamptz not null default now()
);
create index query_files_conversation_idx on public.query_files(conversation_id);
alter table public.query_files enable row level security;
revoke all on public.query_files from anon,authenticated;
grant all on public.query_files to service_role;
alter table public.query_turns add column request_file_ids uuid[], add column new_file_ids uuid[];
create table public.query_file_attempts (
  id uuid primary key,
  session_id uuid not null references public.demo_sessions(id) on delete cascade,
  file_id uuid not null references public.query_files(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index query_file_attempts_session_idx on public.query_file_attempts(session_id);
create index query_file_attempts_time_idx on public.query_file_attempts(created_at);
alter table public.query_file_attempts enable row level security;
revoke all on public.query_file_attempts from anon,authenticated;
grant all on public.query_file_attempts to service_role;

create function public.reserve_query_files(p_session uuid,p_conversation uuid,p_files jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare f jsonb; v_existing public.query_files; v_added boolean=false; v_format text;
begin
  perform 1 from public.query_conversations q join public.demo_sessions s on s.id=q.session_id
    where q.id=p_conversation and q.session_id=p_session and s.expires_at>now() for update of q;
  if not found then raise exception 'Document: Chat unavailable in this session.'; end if;
  if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files)>5 then raise exception 'Document: Choose up to five files per message.'; end if;
  if exists(select 1 from public.query_turns where conversation_id=p_conversation and status='processing' and started_at>now()-interval '5 minutes') then raise exception 'Document: Wait for Wren to finish.'; end if;
  for f in select value from jsonb_array_elements(p_files) loop
    select * into v_existing from public.query_files where id=(f->>'id')::uuid;
    if found then
      if v_existing.conversation_id<>p_conversation or v_existing.session_id<>p_session or v_existing.title<>f->>'title' or v_existing.byte_size<>(f->>'size')::integer then raise exception 'Document: Upload identifier already in use.'; end if;
      continue;
    end if;
    v_format=lower(substring(f->>'title' from '\.([^.]+)$'));
    if v_format not in ('pdf','txt','md') or v_format is null then raise exception 'Document: Choose PDF, TXT or MD.'; end if;
    if (select count(*) from public.query_files where conversation_id=p_conversation)>=20 then raise exception 'Document: This chat has reached its 20-file limit.'; end if;
    if (select count(*) from public.query_files where conversation_id=p_conversation and first_turn_id is null and enabled)>=5 then raise exception 'Document: Send or exclude the pending files before uploading more.'; end if;
    if (select coalesce(sum(byte_size),0) from public.query_files where conversation_id=p_conversation)+(f->>'size')::integer>100000000 then raise exception 'Document: This chat has reached its 100 MB limit.'; end if;
    insert into public.query_files(id,conversation_id,session_id,title,format,storage_path,byte_size)
      values((f->>'id')::uuid,p_conversation,p_session,f->>'title',v_format,p_session::text||'/'||p_conversation::text||'/'||(f->>'id')||'.'||v_format,(f->>'size')::integer);
    v_added=true;
  end loop;
  if v_added then update public.query_conversations set context_revision=context_revision+1,updated_at=now() where id=p_conversation; end if;
end;
$$;

create function public.create_query_file_chat(p_session uuid,p_id uuid,p_request jsonb,p_context jsonb,p_files jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare q public.query_conversations;
begin
  if not exists(select 1 from public.demo_sessions where id=p_session and expires_at>now()) then raise exception 'Document: Session expired.'; end if;
  insert into public.query_conversations(id,session_id,title,request,assistant,chat_context)
    values(p_id,p_session,left(p_request->>'request',120),p_request,true,p_context) on conflict(id) do nothing;
  select * into q from public.query_conversations where id=p_id for update;
  if q.session_id<>p_session or q.request<>p_request or q.chat_context<>p_context or not q.assistant then raise exception 'Document: Chat identifier already in use.'; end if;
  perform public.reserve_query_files(p_session,p_id,p_files);
end;
$$;

create function public.toggle_query_file(p_session uuid,p_id uuid,p_enabled boolean,p_revision integer)
returns void language plpgsql security invoker set search_path='' as $$
declare v_conversation uuid;
begin
  select conversation_id into v_conversation from public.query_files where id=p_id and session_id=p_session;
  perform 1 from public.query_conversations q join public.demo_sessions s on s.id=q.session_id where q.id=v_conversation and q.session_id=p_session and q.context_revision=p_revision and s.expires_at>now() for update of q;
  if not found then raise exception 'Document: Chat changed. Reopen it and try again.'; end if;
  if exists(select 1 from public.query_turns where conversation_id=v_conversation and status='processing' and started_at>now()-interval '5 minutes') then raise exception 'Document: Wait for Wren to finish.'; end if;
  update public.query_files set enabled=p_enabled where id=p_id;
  update public.query_conversations set context_revision=context_revision+1 where id=v_conversation;
end;
$$;

create function public.claim_query_file(p_session uuid,p_id uuid,p_token uuid,p_retry boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.query_files set processing_token=p_token,started_at=now(),error_message=null,
    status=case when status='failed' then case when total>0 then 'reading' else 'extracting' end else status end
    where id=p_id and session_id=p_session and status<>'ready' and status<>'uploading' and (status<>'failed' or p_retry)
      and (processing_token is null or started_at<now()-interval '2 minutes')
      and exists(select 1 from public.demo_sessions where id=p_session and expires_at>now());
  return found;
end;
$$;

create function public.save_query_file_stage(p_session uuid,p_id uuid,p_token uuid,p_patch jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare f public.query_files; v_count integer;
begin
  -- Serialize extracted-text accounting across all documents in the chat.
  perform 1 from public.query_conversations where id=(select conversation_id from public.query_files where id=p_id) and session_id=p_session for update;
  select * into f from public.query_files where id=p_id and session_id=p_session and processing_token=p_token for update;
  if not found or not exists(select 1 from public.demo_sessions where id=p_session and expires_at>now()) then return false; end if;
  v_count=coalesce((p_patch->>'char_count')::integer,f.char_count);
  if v_count+(select coalesce(sum(char_count),0) from public.query_files where conversation_id=f.conversation_id and id<>p_id)>5000000 then raise exception 'Document: This chat exceeds 5,000,000 extracted characters. Exclude this file and use a smaller document.'; end if;
  update public.query_files set pages=coalesce(p_patch->'pages',pages),warnings=coalesce(p_patch->'warnings',warnings),nodes=coalesce(p_patch->'nodes',nodes),
    char_count=v_count,cursor=coalesce((p_patch->>'cursor')::integer,cursor),total=coalesce((p_patch->>'total')::integer,total),
    status=coalesce(p_patch->>'status',status),error_message=p_patch->>'error_message',processing_token=null where id=p_id;
  return true;
end;
$$;

create function public.reserve_query_file_ai(p_session uuid,p_file uuid,p_token uuid,p_session_limit integer,p_daily_limit integer)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('rewoven.query-file-ai-budget',0));
  if not exists(select 1 from public.query_files f join public.demo_sessions s on s.id=f.session_id where f.id=p_file and f.session_id=p_session and f.processing_token=p_token and s.expires_at>now()) then return false; end if;
  if exists(select 1 from public.query_file_attempts where id=p_token) then return true; end if;
  if p_session_limit<0 or p_daily_limit<0 then raise exception 'Invalid limits'; end if;
  if p_session_limit is not null and (select count(*) from public.query_file_attempts where session_id=p_session)>=p_session_limit then return false; end if;
  if p_daily_limit is not null and (select count(*) from public.query_file_attempts where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=p_daily_limit then return false; end if;
  insert into public.query_file_attempts(id,session_id,file_id) values(p_token,p_session,p_file);
  return true;
end;
$$;

-- Preserve the existing function signature and legacy text-only callers.
create or replace function public.claim_assistant_turn(p_session uuid,p_conversation uuid,p_id uuid,p_message text,p_revision integer,p_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_context jsonb; v_revision integer; v_claim jsonb; v_files uuid[]; v_new uuid[];
begin
  select q.chat_context,q.context_revision into v_context,v_revision from public.query_conversations q join public.demo_sessions s on s.id=q.session_id
    where q.id=p_conversation and q.session_id=p_session and s.expires_at>now() and q.assistant for update of q;
  if not found then return jsonb_build_object('state','missing'); end if;
  if not exists(select 1 from public.query_turns where id=p_id and conversation_id=p_conversation) then
    if p_revision is distinct from v_revision then return jsonb_build_object('state','context_changed'); end if;
    if exists(select 1 from public.query_files where conversation_id=p_conversation and enabled and (status<>'ready' or jsonb_array_length(warnings)>0)) then return jsonb_build_object('state','files_pending'); end if;
    select coalesce(array_agg(id order by created_at,id),'{}'),coalesce(array_agg(id order by created_at,id) filter(where first_turn_id is null),'{}') into v_files,v_new from public.query_files where conversation_id=p_conversation and enabled;
  end if;
  v_claim=public.claim_query_turn(p_session,p_conversation,p_id,p_message,'library',null,p_token);
  if v_claim->>'state'='claimed' then
    update public.query_turns set context_snapshot=coalesce(context_snapshot,v_context),phase='understanding',request_file_ids=coalesce(request_file_ids,v_files,'{}'),new_file_ids=coalesce(new_file_ids,v_new,'{}') where id=p_id;
    update public.query_files set first_turn_id=p_id where id=any(v_new);
  end if;
  return v_claim;
end;
$$;

revoke execute on function public.reserve_query_files(uuid,uuid,jsonb),public.create_query_file_chat(uuid,uuid,jsonb,jsonb,jsonb),public.toggle_query_file(uuid,uuid,boolean,integer),public.claim_query_file(uuid,uuid,uuid,boolean),public.save_query_file_stage(uuid,uuid,uuid,jsonb),public.reserve_query_file_ai(uuid,uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_query_files(uuid,uuid,jsonb),public.create_query_file_chat(uuid,uuid,jsonb,jsonb,jsonb),public.toggle_query_file(uuid,uuid,boolean,integer),public.claim_query_file(uuid,uuid,uuid,boolean),public.save_query_file_stage(uuid,uuid,uuid,jsonb),public.reserve_query_file_ai(uuid,uuid,uuid,integer,integer) to service_role;
