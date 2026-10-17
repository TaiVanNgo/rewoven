-- Library search should find literal fragments as users type, while retaining
-- stemmed keyword matching and the existing session/catalog boundaries.
create or replace function public.search_cases(p_session_id uuid, p_query text default '')
returns setof public.cases
language sql stable security invoker set search_path = '' as $$
  select c.* from public.cases c
  where (not c.is_seed or c.sample_visible)
    and (c.is_seed or c.session_id = p_session_id)
    and (trim(p_query) = '' or (c.status = 'ready' and (
      strpos(lower(c.title || ' ' || c.context || ' ' || c.outcome || ' ' || c.lessons), lower(trim(p_query))) > 0
      or to_tsvector('english', c.title || ' ' || c.context || ' ' || c.outcome || ' ' || c.lessons)
        @@ plainto_tsquery('english', p_query)
      or exists (
        select 1
        from public.source_documents d
        join public.source_chunks ch on ch.source_id = d.id
        where d.case_id = c.id and d.status = 'ready'
          and (
            strpos(lower(ch.text), lower(trim(p_query))) > 0
            or ch.search_vector @@ plainto_tsquery('english', p_query)
          )
      )
    )))
  order by c.is_seed asc, c.created_at desc, c.title;
$$;
