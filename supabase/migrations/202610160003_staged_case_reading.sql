alter table public.case_ai_readings
  add column case_id uuid references public.cases(id) on delete cascade,
  add column work jsonb,
  add column error_message text;
create index case_reading_case_idx on public.case_ai_readings(case_id);

create function public.claim_case_reading_step(p_id uuid,p_session uuid,p_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.case_ai_readings r set processing_token=p_token,started_at=now(),error_message=null
    from public.cases c,public.demo_sessions s
    where r.id=p_id and r.case_id=c.id and c.session_id=p_session and not c.is_seed
      and r.session_id=p_session and s.id=p_session and s.expires_at>now()
      and r.status='processing' and (r.processing_token is null or r.started_at<now()-interval '2 minutes');
  return found;
end;
$$;

create function public.save_case_reading_step(p_id uuid,p_token uuid,p_work jsonb,p_result jsonb default null)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.case_ai_readings set work=p_work,result=p_result,processing_token=null,
    status=case when p_result is null then 'processing' else 'ready' end
    where id=p_id and status='processing' and processing_token=p_token;
  return found;
end;
$$;

create function public.review_case_reading(p_case uuid,p_session uuid,p_reading uuid,p_input jsonb,p_expected jsonb)
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
  update public.cases set title=p_input->>'title',context=p_input->>'context',outcome=p_input->>'outcome',lessons=p_input->>'lessons' where id=p_case;
  insert into public.case_ai_reviews(case_id,source_id,reading_id)
    values(p_case,(v_read.work->'sources'->0->>'id')::uuid,p_reading)
    on conflict(case_id) do update set source_id=excluded.source_id,reading_id=excluded.reading_id,created_at=now();
  return true;
end;
$$;
revoke all on function public.claim_case_reading_step(uuid,uuid,uuid),public.save_case_reading_step(uuid,uuid,jsonb,jsonb),public.review_case_reading(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.claim_case_reading_step(uuid,uuid,uuid),public.save_case_reading_step(uuid,uuid,jsonb,jsonb),public.review_case_reading(uuid,uuid,uuid,jsonb,jsonb) to service_role;

create function public.save_case_fields(p_case uuid,p_session uuid,p_input jsonb,p_expected jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_case public.cases;
begin
  select c.* into v_case from public.cases c join public.demo_sessions s on s.id=c.session_id
    where c.id=p_case and c.session_id=p_session and not c.is_seed and s.expires_at>now() for update of c;
  if not found then raise exception 'Case not found'; end if;
  if jsonb_build_object('title',v_case.title,'context',v_case.context,'outcome',v_case.outcome,'lessons',v_case.lessons)<>p_expected then
    raise exception 'Case details changed. Reload current details before saving';
  end if;
  update public.cases set title=p_input->>'title',context=p_input->>'context',outcome=p_input->>'outcome',lessons=p_input->>'lessons' where id=p_case;
  return true;
end;
$$;
revoke all on function public.save_case_fields(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_case_fields(uuid,uuid,jsonb,jsonb) to service_role;
