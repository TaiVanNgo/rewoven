-- Receipts deliberately have no foreign keys: cleanup must survive case/session deletion.
create table public.case_deletions (
  case_id uuid primary key,
  session_id uuid not null,
  storage_paths text[] not null default '{}',
  deleted_at timestamptz not null default now(),
  final_sweep_at timestamptz not null,
  next_attempt_at timestamptz not null default now(),
  cleanup_complete boolean not null default false,
  last_error text
);
create index case_deletions_due_idx on public.case_deletions(next_attempt_at) where not cleanup_complete;
alter table public.case_deletions enable row level security;
revoke all on public.case_deletions from public, anon, authenticated;
grant all on public.case_deletions to service_role;

create function public.prevent_deleted_case_recreation() returns trigger language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('rewoven.case.'||new.id::text,0));
  if exists(select 1 from public.case_deletions where case_id=new.id) then
    raise exception 'This case was permanently deleted. Start a new case.';
  end if;
  return new;
end;
$$;
create trigger prevent_deleted_case_recreation before insert on public.cases
  for each row execute function public.prevent_deleted_case_recreation();

create function public.delete_owned_case(p_case uuid,p_session uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare v_case public.cases; v_paths text[]; v_expiry timestamptz;
begin
  if not exists(select 1 from public.demo_sessions where id=p_session and expires_at>now()) then return 'expired'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rewoven.case.'||p_case::text,0));
  if exists(select 1 from public.case_deletions where case_id=p_case and session_id=p_session) then return 'deleted'; end if;
  select * into v_case from public.cases where id=p_case and (session_id=p_session or is_seed) for update;
  if not found then return 'missing'; end if;
  if v_case.is_seed then return 'readonly'; end if;
  select coalesce(array_agg(storage_path) filter(where storage_path is not null),'{}'),max(upload_expires_at)
    into v_paths,v_expiry from public.source_documents where case_id=p_case;
  -- Signed upload URLs last two hours. Retain paths for a later sweep even when
  -- completion cleared upload_expires_at; a token can still upload after deletion.
  insert into public.case_deletions(case_id,session_id,storage_paths,final_sweep_at,cleanup_complete)
    values(p_case,p_session,v_paths,greatest(now()+interval '130 minutes',v_expiry+interval '5 minutes'),cardinality(v_paths)=0);
  update public.query_conversations q set
    chat_context=jsonb_set(q.chat_context,'{caseIds}',coalesce((select jsonb_agg(x) from jsonb_array_elements(q.chat_context->'caseIds') x where x<>to_jsonb(p_case::text)),'[]')),
    context_revision=context_revision+1,updated_at=now()
    where q.session_id=p_session and q.chat_context->'caseIds' @> jsonb_build_array(p_case::text);
  -- Keep selected mode when the last selection disappears. The user must choose
  -- a new scope explicitly rather than silently searching the whole library.
  delete from public.cases where id=p_case;
  return 'deleted';
end;
$$;

-- Serialize final answer publication with case deletion. A server-side check
-- alone has a gap between checking evidence and committing the generated answer.
create function public.case_evidence_current(p_evidence jsonb,p_context jsonb,p_session uuid) returns boolean
language plpgsql set search_path='' as $$
declare v_id uuid; v_item jsonb;
begin
  if p_context->>'mode'='selected' and jsonb_array_length(p_context->'caseIds')=0 then return false; end if;
  for v_id in
    select distinct id from (
      select (x->>'case_id')::uuid id from jsonb_array_elements(coalesce(p_evidence,'[]')) x
      union select x::uuid from jsonb_array_elements_text(coalesce(p_context->'caseIds','[]')) x
    ) ids order by id
  loop
    perform 1 from public.cases where id=v_id and (is_seed or session_id=p_session) for key share;
    if not found then return false; end if;
  end loop;
  for v_item in select * from jsonb_array_elements(coalesce(p_evidence,'[]')) loop
    if not exists(select 1 from public.source_chunks ch join public.source_documents d on d.id=ch.source_id
      where ch.id=(v_item->>'chunk_id')::uuid and d.id=(v_item->>'source_id')::uuid
        and d.case_id=(v_item->>'case_id')::uuid and d.version=(v_item->>'version')::integer
        and d.status='ready' and ch.text=v_item->>'text') then return false; end if;
  end loop;
  return true;
end;
$$;
create function public.guard_query_evidence() returns trigger language plpgsql set search_path='' as $$
declare v_session uuid;
begin
  if new.status='ready' and old.status<>'ready' then
    select session_id into v_session from public.query_conversations where id=new.conversation_id;
    if not public.case_evidence_current(new.work->'evidence',new.context_snapshot,v_session) then
      raise exception 'Sources changed while Wren was answering. Choose cases or search full library, then retry.';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_query_evidence before update of status on public.query_turns
  for each row execute function public.guard_query_evidence();
create function public.guard_plan_evidence() returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='ready' and old.status<>'ready' and not public.case_evidence_current(new.evidence,new.snapshot->'context',new.session_id) then
    raise exception 'Sources changed while Wren was answering. Create a new plan with current cases.';
  end if;
  return new;
end;
$$;
create trigger guard_plan_evidence before update of status on public.reuse_plans
  for each row execute function public.guard_plan_evidence();
revoke execute on function public.delete_owned_case(uuid,uuid),public.prevent_deleted_case_recreation(),public.case_evidence_current(jsonb,jsonb,uuid),public.guard_query_evidence(),public.guard_plan_evidence() from public,anon,authenticated;
grant execute on function public.delete_owned_case(uuid,uuid),public.prevent_deleted_case_recreation(),public.case_evidence_current(jsonb,jsonb,uuid),public.guard_query_evidence(),public.guard_plan_evidence() to service_role;
