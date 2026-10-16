-- Additive: existing cases and completed AI drafts remain intact.
alter table public.cases
  add column overview jsonb,
  add column overview_revision integer not null default 0,
  add column sample_visible boolean not null default true,
  add constraint overview_schema check (overview is null or (jsonb_typeof(overview)='object' and overview->>'schemaVersion'='1'));

create or replace function public.review_case_reading(p_case uuid,p_session uuid,p_reading uuid,p_input jsonb,p_expected jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_case public.cases;v_read public.case_ai_readings;v_count integer;
begin
  select c.* into v_case from public.cases c join public.demo_sessions s on s.id=c.session_id
    where c.id=p_case and c.session_id=p_session and not c.is_seed and s.expires_at>now() for update of c;
  if not found then raise exception 'Case not found'; end if;
  if jsonb_build_object('title',v_case.title,'context',v_case.context,'outcome',v_case.outcome,'lessons',v_case.lessons)<>p_expected then
    raise exception 'Case details changed. Reload the current details before applying this draft';
  end if;
  select * into v_read from public.case_ai_readings where id=p_reading and case_id=p_case and session_id=p_session and status='ready';
  if not found then raise exception 'A completed reading for this case is required'; end if;
  select count(*) into v_count from public.source_documents where case_id=p_case;
  if v_count<>jsonb_array_length(v_read.work->'sources') or exists(
    select 1 from public.source_documents d where d.case_id=p_case and (d.status<>'ready' or not exists(
      select 1 from jsonb_array_elements(v_read.work->'sources') x where (x->>'id')::uuid=d.id and (x->>'version')::integer=d.version and (x->>'chars')::integer=d.char_count
    ))
  ) then raise exception 'Sources changed. Read all documents again before applying this draft'; end if;
  if p_input ? 'overview' then
    if not (p_input ? 'overview_revision') or (p_input->>'overview_revision')::integer <> v_case.overview_revision then
      raise exception 'Case overview changed. Reload before saving';
    end if;
  elsif v_case.overview is not null then
    raise exception 'A structured overview is required. Reload before saving';
  end if;
  update public.cases set overview=case when p_input ? 'overview' then p_input->'overview' else overview end, overview_revision=overview_revision+1,title=p_input->>'title',context=p_input->>'context',outcome=p_input->>'outcome',lessons=p_input->>'lessons' where id=p_case;
  insert into public.case_ai_reviews(case_id,source_id,reading_id)
    values(p_case,(v_read.work->'sources'->0->>'id')::uuid,p_reading)
    on conflict(case_id) do update set source_id=excluded.source_id,reading_id=excluded.reading_id,created_at=now();
  return true;
end;
$$;
create or replace function public.save_case_fields(p_case uuid,p_session uuid,p_input jsonb,p_expected jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_case public.cases;
begin
  select c.* into v_case from public.cases c join public.demo_sessions s on s.id=c.session_id
    where c.id=p_case and c.session_id=p_session and not c.is_seed and s.expires_at>now() for update of c;
  if not found then raise exception 'Case not found'; end if;
  if jsonb_build_object('title',v_case.title,'context',v_case.context,'outcome',v_case.outcome,'lessons',v_case.lessons)<>p_expected then
    raise exception 'Case details changed. Reload current details before saving';
  end if;
  if p_input ? 'overview' then
    if not (p_input ? 'overview_revision') or (p_input->>'overview_revision')::integer <> v_case.overview_revision then
      raise exception 'Case overview changed. Reload before saving';
    end if;
  elsif v_case.overview is not null then
    raise exception 'A structured overview is required. Reload before saving';
  end if;
  update public.cases set overview=case when p_input ? 'overview' then p_input->'overview' else overview end, overview_revision=overview_revision+1,title=p_input->>'title',context=p_input->>'context',outcome=p_input->>'outcome',lessons=p_input->>'lessons' where id=p_case;
  return true;
end;
$$;
create or replace function public.retrieve_passages(p_session uuid,p_query text,p_vector extensions.vector(1536) default null)
returns table(chunk_id uuid,source_id uuid,case_id uuid,title text,source_title text,version integer,page_number integer,char_start integer,char_end integer,text text,outcome text,score double precision)
language sql stable set search_path = '' as $$
  with eligible as (
    select ch.*,d.case_id,d.title source_title,d.version,c.title,c.outcome,
      case when p_vector is not null and ch.embedding_model='text-embedding-3-small' then 1-(ch.embedding OPERATOR(extensions.<=>) p_vector) end similarity
    from public.source_chunks ch join public.source_documents d on d.id=ch.source_id join public.cases c on c.id=d.case_id
    where (not c.is_seed or c.sample_visible) and d.status='ready' and (c.is_seed or c.session_id=p_session)
      and exists(select 1 from public.demo_sessions where id=p_session and expires_at>now())
  ), query as (
    select to_tsquery('english',coalesce(nullif(array_to_string(array(select quote_literal(x) from unnest(tsvector_to_array(to_tsvector('english',p_query))) x), ' | '),''), 'rewovenemptyquery')) q
  ), semantic as (
    select id,row_number() over(order by similarity desc,id) rank from eligible where similarity>=0.40 order by similarity desc,id limit 30
  ), keyword as (
    select id,row_number() over(order by ts_rank_cd(search_vector,q) desc,id) rank from eligible,query
      where search_vector@@q and (p_vector is null or similarity>=0.40) order by ts_rank_cd(search_vector,q) desc,id limit 30
  ), fused as (
    select coalesce(s.id,k.id) id,coalesce(1.0/(50+s.rank),0)+coalesce(1.0/(50+k.rank),0) score
    from semantic s full join keyword k on s.id=k.id
  ) select e.id,e.source_id,e.case_id,e.title,e.source_title,e.version,e.page_number,e.char_start,e.char_end,e.text,e.outcome,f.score::double precision
    from fused f join eligible e on e.id=f.id order by f.score desc,e.id;
$$;

create or replace function public.search_cases(p_session_id uuid,p_query text default '')
returns setof public.cases language sql stable security invoker set search_path='' as $$
  select c.* from public.cases c where (not c.is_seed or c.sample_visible) and (c.is_seed or c.session_id=p_session_id)
    and (trim(p_query)='' or (c.status='ready' and (
      to_tsvector('english',c.title||' '||c.context||' '||c.outcome||' '||c.lessons)@@plainto_tsquery('english',p_query)
      or exists(select 1 from public.source_documents d join public.source_chunks ch on ch.source_id=d.id
        where d.case_id=c.id and d.status='ready' and ch.search_vector@@plainto_tsquery('english',p_query)))))
  order by c.is_seed asc,c.created_at desc,c.title;
$$;

-- Publish a fully validated catalog together; a failed import leaves the old set visible.
create function public.activate_sample_catalog(p_new uuid[], p_legacy uuid[])
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtext('rewoven-sample-catalog'));
  if cardinality(p_new) <> 9 or (select count(*) from public.cases c where c.id=any(p_new) and c.is_seed and c.status='ready' and c.overview is not null and exists(select 1 from public.source_documents d where d.case_id=c.id and d.status='ready')) <> 9 then
    raise exception 'All nine validated samples must be ready before activation';
  end if;
  update public.cases set sample_visible=false where is_seed and id=any(p_legacy) and not(id=any(p_new));
  update public.cases set sample_visible=true where is_seed and id=any(p_new);
end;
$$;
revoke all on function public.activate_sample_catalog(uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.activate_sample_catalog(uuid[],uuid[]) to service_role;
