create extension if not exists vector with schema extensions;

-- Match JavaScript string.length, including surrogate pairs, for all quotas/offsets.
create function public.source_length(p_text text) returns integer language sql immutable set search_path = '' as $$
  select coalesce(sum(case when ascii(c) > 65535 then 2 else 1 end), 0)::integer
  from regexp_split_to_table(p_text, '') c;
$$;
alter table public.source_documents
  add column status text not null default 'queued' check (status in ('uploading','queued','extracting','ready','failed')),
  add column indexing_status text not null default 'pending' check (indexing_status in ('pending','ready','failed')),
  add column error_message text,
  add column indexing_error text,
  add column byte_size bigint,
  add column char_count integer not null default 0,
  add column extraction_cursor integer not null default 0,
  add column page_count integer not null default 0,
  add column processing_token uuid,
  add column processing_started_at timestamptz,
  add column upload_expires_at timestamptz;
update public.source_documents d set
  status = case when extracted_text is not null then 'ready' when c.status = 'failed' then 'failed' else 'queued' end,
  char_count = public.source_length(coalesce(extracted_text,'')),
  byte_size = coalesce(octet_length(original_text), (select (o.metadata->>'size')::bigint from storage.objects o where o.bucket_id = 'case-sources' and o.name = d.storage_path)),
  page_count = jsonb_array_length(pages), extraction_cursor = jsonb_array_length(pages)
from public.cases c where c.id = d.case_id;
alter table public.source_chunks
  add column embedding extensions.vector(1536),
  add column embedding_model text,
  add column chunk_version integer not null default 1;

create function public.refresh_case_status(p_id uuid) returns void language sql set search_path = '' as $$
  update public.cases c set
    status = case when exists(select 1 from public.source_documents where case_id = p_id and status = 'ready') then 'ready'
      when not exists(select 1 from public.source_documents where case_id = p_id) or exists(select 1 from public.source_documents where case_id = p_id and status in ('uploading','queued','extracting')) then 'processing' else 'failed' end,
    error_message = (select error_message from public.source_documents where case_id = p_id and status = 'failed' order by created_at limit 1)
  where c.id = p_id;
$$;

create function public.reserve_source(p_case uuid, p_session uuid, p_id uuid, p_title text, p_format text, p_bytes bigint, p_text text default null)
returns public.source_documents language plpgsql set search_path = '' as $$
declare v_source public.source_documents;
begin
  perform 1 from public.cases c join public.demo_sessions s on s.id = c.session_id
    where c.id = p_case and c.session_id = p_session and not c.is_seed and s.expires_at > now() for update of c;
  if not found then raise exception 'Case not found'; end if;
  select * into v_source from public.source_documents where id = p_id and case_id = p_case for update;
  if found then
    if v_source.processing_token is not null and v_source.processing_started_at > now()-interval '2 minutes' then raise exception 'Upload reconciliation is busy. Try again shortly'; end if;
    if v_source.status='uploading' then
      update public.source_documents set upload_expires_at=now()+interval '125 minutes',processing_token=null where id=p_id returning * into v_source;
    end if;
    return v_source;
  end if;
  if exists(select 1 from public.source_documents where case_id=p_case and byte_size is null) then raise exception 'Original sizes need backfill before adding documents'; end if;
  if p_bytes < 1 or p_bytes > 5000000 then raise exception 'File exceeds 5 MB or is empty'; end if;
  if p_text is not null and (public.source_length(p_text) > 500000 or length(trim(p_text))=0 or octet_length(p_text)<>p_bytes or p_format<>'text') then raise exception 'Invalid pasted source'; end if;
  if (select count(*) from public.source_documents where case_id=p_case) >= 50 then raise exception 'Case limit: 50 documents'; end if;
  if (select coalesce(sum(byte_size),0) from public.source_documents where case_id=p_case) + p_bytes > 100000000 then raise exception 'Case limit: 100 MB of original material'; end if;
  if p_text is not null and (select coalesce(sum(char_count),0) from public.source_documents where case_id=p_case) + public.source_length(p_text) > 5000000 then raise exception 'Case limit: 5,000,000 extracted characters'; end if;
  insert into public.source_documents(id,case_id,title,format,original_text,storage_path,byte_size,status,upload_expires_at)
    values(p_id,p_case,p_title,p_format,p_text,
      case when p_text is null then p_session::text||'/'||p_case::text||'/'||p_id::text||'/source.'||p_format end,
      p_bytes,case when p_text is null then 'uploading' else 'queued' end,
      case when p_text is null then now()+interval '125 minutes' end) returning * into v_source;
  perform public.refresh_case_status(p_case);
  return v_source;
end;
$$;

create function public.claim_source(p_id uuid,p_session uuid,p_token uuid,p_retry boolean default false)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.source_documents d set processing_token=p_token,processing_started_at=now(),
    status=case when d.status='failed' then 'queued' else d.status end,
    indexing_status=case when p_retry and indexing_status='failed' then 'pending' else indexing_status end,
    error_message=null,indexing_error=null
  from public.cases c where d.id=p_id and c.id=d.case_id
    and ((c.session_id=p_session and not c.is_seed and exists(select 1 from public.demo_sessions where id=p_session and expires_at>now())) or (p_session is null and c.is_seed))
    and (d.processing_token is null or d.processing_started_at<now()-interval '2 minutes')
    and (d.status in ('queued','extracting') or (d.status='ready' and d.indexing_status='pending') or (p_retry and (d.status='failed' or d.indexing_status='failed')));
  return found;
end;
$$;

create function public.save_source_stage(p_id uuid,p_token uuid,p_pages jsonb,p_warnings jsonb,p_cursor integer,p_count integer,p_complete boolean,p_chunks jsonb)
returns boolean language plpgsql set search_path = '' as $$
declare v_source public.source_documents; v_text text; v_chars integer;
begin
  perform 1 from public.cases where id=(select case_id from public.source_documents where id=p_id) for update;
  select * into v_source from public.source_documents where id=p_id and processing_token=p_token for update;
  if not found then return false; end if;
  select string_agg(x->>'text', E'\n\n' order by (x->>'number')::integer) into v_text from jsonb_array_elements(p_pages) x;
  v_chars:=public.source_length(coalesce(v_text,''));
  if v_chars>500000 then raise exception 'Extracted text exceeds 500,000 characters; no text was truncated'; end if;
  if p_complete and (select coalesce(sum(char_count),0) from public.source_documents where case_id=v_source.case_id and id<>p_id)+v_chars>5000000 then raise exception 'Case limit: 5,000,000 extracted characters'; end if;
  if p_complete and length(trim(coalesce(v_text,'')))=0 then raise exception 'No readable embedded text. Scanned PDFs need OCR, which is not supported'; end if;
  update public.source_documents set pages=p_pages,warnings=p_warnings,extraction_cursor=p_cursor,page_count=p_count,
    status=case when p_complete then 'ready' else 'extracting' end,
    extracted_text=case when p_complete then v_text end,char_count=case when p_complete then v_chars else 0 end,
    processing_token=null where id=p_id;
  if p_complete then
    insert into public.source_chunks(source_id,ordinal,page_number,char_start,char_end,text)
      select p_id,x.ordinal,x.page_number,x.char_start,x.char_end,x.text from jsonb_to_recordset(p_chunks)
      as x(ordinal integer,page_number integer,char_start integer,char_end integer,text text)
      on conflict(source_id,ordinal) do nothing;
  end if;
  perform public.refresh_case_status(v_source.case_id);
  return true;
end;
$$;

create table public.embedding_usage (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.demo_sessions(id) on delete cascade,
  tokens integer not null check(tokens>=0),
  created_at timestamptz not null default now()
);
alter table public.embedding_usage enable row level security;
create function public.reserve_embedding_budget(p_session uuid,p_tokens integer,p_session_limit integer,p_daily_limit integer)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('rewoven.embedding-budget',0));
  if p_tokens<1 then raise exception 'Invalid embedding budget'; end if;
  if p_session is not null and not exists(select 1 from public.demo_sessions where id=p_session and expires_at>now()) then raise exception 'Session expired'; end if;
  if (p_session is not null and (select coalesce(sum(tokens),0) from public.embedding_usage where session_id=p_session)+p_tokens>p_session_limit)
    or (select coalesce(sum(tokens),0) from public.embedding_usage where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')+p_tokens>p_daily_limit then
    raise exception 'Embedding token budget reached. Indexing is paused; retry when capacity is available';
  end if;
  insert into public.embedding_usage(session_id,tokens) values(p_session,p_tokens) returning id into v_id;
  return v_id;
end;
$$;

create function public.save_source_embeddings(p_id uuid,p_token uuid,p_vectors jsonb)
returns boolean language plpgsql set search_path = '' as $$
begin
  perform 1 from public.source_documents where id=p_id and processing_token=p_token and status='ready' for update;
  if not found then return false; end if;
  update public.source_chunks ch set embedding=(x.embedding::text)::extensions.vector,embedding_model='text-embedding-3-small'
    from jsonb_to_recordset(p_vectors) as x(id uuid,embedding jsonb) where ch.id=x.id and ch.source_id=p_id;
  update public.source_documents set processing_token=null,indexing_status=case when exists(select 1 from public.source_chunks where source_id=p_id and embedding is null) then 'pending' else 'ready' end,indexing_error=null where id=p_id;
  return true;
end;
$$;

create function public.retrieve_passages(p_session uuid,p_query text,p_vector extensions.vector(1536) default null)
returns table(chunk_id uuid,source_id uuid,case_id uuid,title text,source_title text,version integer,page_number integer,char_start integer,char_end integer,text text,outcome text,score double precision)
language sql stable set search_path = '' as $$
  with eligible as (
    select ch.*,d.case_id,d.title source_title,d.version,c.title,c.outcome,
      case when p_vector is not null and ch.embedding_model='text-embedding-3-small' then 1-(ch.embedding OPERATOR(extensions.<=>) p_vector) end similarity
    from public.source_chunks ch join public.source_documents d on d.id=ch.source_id join public.cases c on c.id=d.case_id
    where d.status='ready' and (c.is_seed or c.session_id=p_session)
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

-- No browser database access. All ownership checks also run in the server routes.
revoke all on public.embedding_usage from public,anon,authenticated;
grant select,insert,update,delete on public.embedding_usage to service_role;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('source_length','refresh_case_status','reserve_source','claim_source','save_source_stage','reserve_embedding_budget','save_source_embeddings','retrieve_passages') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;

-- A partially failed case must never expose chunks from a failed source.
create or replace function public.search_cases(p_session_id uuid,p_query text default '')
returns setof public.cases language sql stable security invoker set search_path='' as $$
  select c.* from public.cases c where (c.is_seed or c.session_id=p_session_id)
    and (trim(p_query)='' or (c.status='ready' and (
      to_tsvector('english',c.title||' '||c.context||' '||c.outcome||' '||c.lessons)@@plainto_tsquery('english',p_query)
      or exists(select 1 from public.source_documents d join public.source_chunks ch on ch.source_id=d.id
        where d.case_id=c.id and d.status='ready' and ch.search_vector@@plainto_tsquery('english',p_query)))))
  order by c.is_seed asc,c.created_at desc,c.title;
$$;
