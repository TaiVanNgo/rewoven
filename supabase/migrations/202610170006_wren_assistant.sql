alter table public.query_conversations
  add column assistant boolean not null default false,
  add column chat_context jsonb not null default '{"mode":"library","caseIds":[]}',
  add column context_revision integer not null default 0;
update public.query_conversations set chat_context=jsonb_build_object('mode','selected','caseIds',jsonb_build_array(focused_case_id)) where focused_case_id is not null;
alter table public.query_turns add column context_snapshot jsonb, add column phase text;

create function public.update_query_context(p_session uuid,p_conversation uuid,p_revision integer,p_context jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.query_conversations q join public.demo_sessions s on s.id=q.session_id
    where q.id=p_conversation and q.session_id=p_session and s.expires_at>now() and q.context_revision=p_revision for update of q;
  if not found then return false; end if;
  if exists(select 1 from public.query_turns where conversation_id=p_conversation and status='processing' and started_at>now()-interval '5 minutes') then return false; end if;
  update public.query_conversations set chat_context=p_context,context_revision=context_revision+1,assistant=true,updated_at=now() where id=p_conversation;
  return true;
end;
$$;

create function public.claim_assistant_turn(p_session uuid,p_conversation uuid,p_id uuid,p_message text,p_revision integer,p_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_context jsonb; v_revision integer; v_claim jsonb;
begin
  select q.chat_context,q.context_revision into v_context,v_revision from public.query_conversations q join public.demo_sessions s on s.id=q.session_id
    where q.id=p_conversation and q.session_id=p_session and s.expires_at>now() and q.assistant for update of q;
  if not found then return jsonb_build_object('state','missing'); end if;
  if not exists(select 1 from public.query_turns where id=p_id and conversation_id=p_conversation) and p_revision is distinct from v_revision then return jsonb_build_object('state','context_changed'); end if;
  v_claim=public.claim_query_turn(p_session,p_conversation,p_id,p_message,'library',null,p_token);
  if v_claim->>'state'='claimed' then
    update public.query_turns set context_snapshot=coalesce(context_snapshot,v_context),phase='understanding' where id=p_id;
  end if;
  return v_claim;
end;
$$;

-- Filter before ranking; unlike legacy discovery, assistant searches never impose a three-case cap.
create function public.retrieve_assistant_passages(p_session uuid,p_query text,p_vector extensions.vector(1536) default null,p_cases uuid[] default null)
returns table(chunk_id uuid,source_id uuid,case_id uuid,title text,source_title text,version integer,page_number integer,char_start integer,char_end integer,text text,outcome text,score double precision)
language sql stable security invoker set search_path='' as $$
  with eligible as (
    select ch.*,d.case_id,d.title source_title,d.version,c.title,c.outcome,
      case when p_vector is not null and ch.embedding_model='text-embedding-3-small' then 1-(ch.embedding OPERATOR(extensions.<=>) p_vector) end similarity
    from public.source_chunks ch join public.source_documents d on d.id=ch.source_id join public.cases c on c.id=d.case_id
    where d.status='ready' and (c.session_id=p_session or c.is_seed)
      and case when p_cases is null then c.session_id=p_session and not c.is_seed else c.id=any(p_cases) end
      and exists(select 1 from public.demo_sessions where id=p_session and expires_at>now())
  ), query as (
    select to_tsquery('english',coalesce(nullif(array_to_string(array(select quote_literal(x) from unnest(tsvector_to_array(to_tsvector('english',p_query))) x),' | '),''),'rewovenemptyquery')) q
  ), semantic as (
    select id,row_number() over(order by similarity desc,id) rank from eligible where similarity>=0.40 order by similarity desc,id limit 60
  ), keyword as (
    select id,row_number() over(order by ts_rank_cd(search_vector,q) desc,id) rank from eligible,query where search_vector@@q order by ts_rank_cd(search_vector,q) desc,id limit 60
  ), fused as (
    select coalesce(s.id,k.id) id,coalesce(1.0/(50+s.rank),0)+coalesce(1.0/(50+k.rank),0) score from semantic s full join keyword k on s.id=k.id
  ) select e.id,e.source_id,e.case_id,e.title,e.source_title,e.version,e.page_number,e.char_start,e.char_end,e.text,e.outcome,f.score::double precision from fused f join eligible e on e.id=f.id order by f.score desc,e.id limit 60;
$$;
revoke execute on function public.update_query_context(uuid,uuid,integer,jsonb),public.claim_assistant_turn(uuid,uuid,uuid,text,integer,uuid),public.retrieve_assistant_passages(uuid,text,extensions.vector,uuid[]) from public,anon,authenticated;
grant execute on function public.update_query_context(uuid,uuid,integer,jsonb),public.claim_assistant_turn(uuid,uuid,uuid,text,integer,uuid),public.retrieve_assistant_passages(uuid,text,extensions.vector,uuid[]) to service_role;
