-- The MVP library includes active seeded history and this session's uploads.
-- Explicit attachments can still resolve retained historical citation targets.
create or replace function public.retrieve_assistant_passages(p_session uuid,p_query text,p_vector extensions.vector(1536) default null,p_cases uuid[] default null)
returns table(chunk_id uuid,source_id uuid,case_id uuid,title text,source_title text,version integer,page_number integer,char_start integer,char_end integer,text text,outcome text,score double precision)
language sql stable security invoker set search_path='' as $$
  with eligible as (
    select ch.*,d.case_id,d.title source_title,d.version,c.title,c.outcome,
      case when p_vector is not null and ch.embedding_model='text-embedding-3-small' then 1-(ch.embedding OPERATOR(extensions.<=>) p_vector) end similarity
    from public.source_chunks ch join public.source_documents d on d.id=ch.source_id join public.cases c on c.id=d.case_id
    where d.status='ready'
      and (c.session_id=p_session or (c.is_seed and (c.sample_visible or p_cases is not null)))
      and (p_cases is null or c.id=any(p_cases))
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

revoke execute on function public.retrieve_assistant_passages(uuid,text,extensions.vector,uuid[]) from public,anon,authenticated;
grant execute on function public.retrieve_assistant_passages(uuid,text,extensions.vector,uuid[]) to service_role;
