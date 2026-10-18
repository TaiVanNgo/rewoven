-- Publish the complete three-document project history together. Existing source
-- rows remain available to saved citations; new discovery sees only the new set.
create or replace function public.activate_sample_catalog(p_new uuid[], p_legacy uuid[])
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtext('rewoven-sample-catalog'));
  if cardinality(p_new) <> 9
    or (select count(distinct x) from unnest(p_new) x) <> 9
    or (select count(*) from public.cases c
      where c.id=any(p_new) and c.is_seed and c.status='ready'
        and c.overview is not null
        and (select count(*) from public.source_documents d
          where d.case_id=c.id and d.status='ready'
            and exists(select 1 from public.source_chunks ch where ch.source_id=d.id)) = 3
        and jsonb_array_length(c.overview->'sources') = 3
    ) <> 9 then
    raise exception 'All nine projects must have three validated Ready sources before activation';
  end if;
  update public.cases set sample_visible=false where is_seed and not(id=any(p_new));
  update public.cases set sample_visible=true where is_seed and id=any(p_new);
end;
$$;
revoke all on function public.activate_sample_catalog(uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.activate_sample_catalog(uuid[],uuid[]) to service_role;
