create table public.query_conversations (
  id uuid primary key,
  session_id uuid not null references public.demo_sessions(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  request jsonb not null,
  focused_case_id uuid references public.cases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index query_conversations_session_idx on public.query_conversations(session_id, updated_at desc);

create table public.query_turns (
  id uuid primary key,
  conversation_id uuid not null references public.query_conversations(id) on delete cascade,
  ordinal integer not null,
  message text not null check (length(trim(message)) between 1 and 10000),
  scope text not null check (scope in ('library','case','related')),
  focused_case_id uuid references public.cases(id) on delete set null,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  work jsonb,
  answer jsonb,
  error_message text,
  processing_token uuid,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(conversation_id, ordinal)
);
create table public.query_ai_attempts (
  id uuid primary key,
  session_id uuid not null references public.demo_sessions(id) on delete cascade,
  turn_id uuid not null references public.query_turns(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index query_attempts_session_idx on public.query_ai_attempts(session_id);
create index query_attempts_created_idx on public.query_ai_attempts(created_at);

alter table public.query_conversations enable row level security;
alter table public.query_turns enable row level security;
alter table public.query_ai_attempts enable row level security;
revoke all on public.query_conversations,public.query_turns,public.query_ai_attempts from anon,authenticated;
grant all on public.query_conversations,public.query_turns,public.query_ai_attempts to service_role;

-- Serialize turns within a conversation, including duplicate requests and retries.
create function public.claim_query_turn(p_session uuid,p_conversation uuid,p_id uuid,p_message text,p_scope text,p_case uuid,p_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_turn public.query_turns; v_ordinal integer;
begin
  perform 1 from public.query_conversations q join public.demo_sessions s on s.id=q.session_id
    where q.id=p_conversation and q.session_id=p_session and s.expires_at>now() for update of q;
  if not found then return jsonb_build_object('state','missing'); end if;
  if p_case is not null and not exists(select 1 from public.cases where id=p_case and (is_seed or session_id=p_session)) then
    return jsonb_build_object('state','missing');
  end if;
  if p_scope not in ('library','case','related') or (p_scope<>'library' and p_case is null) then
    return jsonb_build_object('state','invalid');
  end if;
  select * into v_turn from public.query_turns where id=p_id;
  if found then
    if v_turn.conversation_id<>p_conversation or v_turn.message<>p_message or v_turn.scope<>p_scope or v_turn.focused_case_id is distinct from p_case then
      return jsonb_build_object('state','conflict');
    end if;
    if v_turn.status='ready' then return jsonb_build_object('state','cached'); end if;
    if v_turn.status='processing' and v_turn.started_at>now()-interval '5 minutes' then
      return jsonb_build_object('state','busy');
    end if;
    if exists(select 1 from public.query_turns where conversation_id=p_conversation and ordinal>v_turn.ordinal) then
      return jsonb_build_object('state','conflict');
    end if;
    update public.query_turns set status='processing',processing_token=p_token,started_at=now(),error_message=null where id=p_id;
  else
    if exists(select 1 from public.query_turns where conversation_id=p_conversation and status='processing' and started_at>now()-interval '5 minutes') then
      return jsonb_build_object('state','busy');
    end if;
    update public.query_turns set status='failed',processing_token=null,error_message='This turn was interrupted. Ask again or retry the latest turn.'
      where conversation_id=p_conversation and status='processing';
    select coalesce(max(ordinal),0)+1 into v_ordinal from public.query_turns where conversation_id=p_conversation;
    insert into public.query_turns(id,conversation_id,ordinal,message,scope,focused_case_id,processing_token)
      values(p_id,p_conversation,v_ordinal,p_message,p_scope,p_case,p_token);
  end if;
  update public.query_conversations set updated_at=now() where id=p_conversation;
  return jsonb_build_object('state','claimed');
end;
$$;

create function public.reserve_query_ai(p_session uuid,p_turn uuid,p_token uuid,p_session_limit integer,p_daily_limit integer)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('rewoven.query-ai-budget',0));
  if not exists(select 1 from public.query_turns t join public.query_conversations q on q.id=t.conversation_id
    join public.demo_sessions s on s.id=q.session_id where t.id=p_turn and t.processing_token=p_token
    and q.session_id=p_session and s.expires_at>now()) then return false; end if;
  if exists(select 1 from public.query_ai_attempts where id=p_token) then return true; end if;
  if p_session_limit<0 or p_daily_limit<0 then raise exception 'Invalid query limits'; end if;
  if p_session_limit is not null and (select count(*) from public.query_ai_attempts where session_id=p_session)>=p_session_limit then return false; end if;
  if p_daily_limit is not null and (select count(*) from public.query_ai_attempts where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=p_daily_limit then return false; end if;
  insert into public.query_ai_attempts(id,session_id,turn_id) values(p_token,p_session,p_turn);
  return true;
end;
$$;

-- Keep the original retrieval RPC unchanged for existing clients.
create function public.retrieve_query_passages(p_session uuid,p_query text,p_vector extensions.vector(1536) default null,p_case uuid default null,p_exclude uuid default null)
returns table(chunk_id uuid,source_id uuid,case_id uuid,title text,source_title text,version integer,page_number integer,char_start integer,char_end integer,text text,outcome text,score double precision)
language sql stable security invoker set search_path='' as $$
  with eligible as (
    select ch.*,d.case_id,d.title source_title,d.version,c.title,c.outcome,
      case when p_vector is not null and ch.embedding_model='text-embedding-3-small' then 1-(ch.embedding OPERATOR(extensions.<=>) p_vector) end similarity
    from public.source_chunks ch join public.source_documents d on d.id=ch.source_id join public.cases c on c.id=d.case_id
    where d.status='ready' and (c.is_seed or c.session_id=p_session)
      and (p_case is null or c.id=p_case) and (p_exclude is null or c.id<>p_exclude)
      and exists(select 1 from public.demo_sessions where id=p_session and expires_at>now())
  ), query as (
    select to_tsquery('english',coalesce(nullif(array_to_string(array(select quote_literal(x) from unnest(tsvector_to_array(to_tsvector('english',p_query))) x),' | '),''),'rewovenemptyquery')) q
  ), semantic as (
    select id,row_number() over(order by similarity desc,id) rank from eligible where similarity>=0.40 or (p_case is not null and similarity is not null) order by similarity desc,id limit 30
  ), keyword as (
    select id,row_number() over(order by ts_rank_cd(search_vector,q) desc,id) rank from eligible,query
      where search_vector@@q order by ts_rank_cd(search_vector,q) desc,id limit 30
  ), fused as (
    select coalesce(s.id,k.id) id,coalesce(1.0/(50+s.rank),0)+coalesce(1.0/(50+k.rank),0) score
    from semantic s full join keyword k on s.id=k.id
  ) select e.id,e.source_id,e.case_id,e.title,e.source_title,e.version,e.page_number,e.char_start,e.char_end,e.text,e.outcome,f.score::double precision
    from fused f join eligible e on e.id=f.id order by f.score desc,e.id;
$$;

revoke execute on function public.claim_query_turn(uuid,uuid,uuid,text,text,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.reserve_query_ai(uuid,uuid,uuid,integer,integer) from public,anon,authenticated;
revoke execute on function public.retrieve_query_passages(uuid,text,extensions.vector,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_query_turn(uuid,uuid,uuid,text,text,uuid,uuid) to service_role;
grant execute on function public.reserve_query_ai(uuid,uuid,uuid,integer,integer) to service_role;
grant execute on function public.retrieve_query_passages(uuid,text,extensions.vector,uuid,uuid) to service_role;
