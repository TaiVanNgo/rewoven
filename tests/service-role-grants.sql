-- Emulate a hosted project without automatic service_role table grants.
begin;
revoke all on table public.demo_sessions, public.cases,
  public.source_documents, public.source_chunks from service_role;

-- Apply the repair inside the transaction so no local data or grants change.
\ir ../supabase/migrations/202610160001_case_library_service_role_grants.sql

set local role service_role;
insert into public.demo_sessions (token_hash)
  values ('permission-regression-' || gen_random_uuid()) returning id;
select id from public.cases limit 0;
select id from public.source_documents limit 0;
select id from public.source_chunks limit 0;
reset role;

do $$
declare
  table_name text;
  permission_name text;
  restricted_role text;
begin
  foreach table_name in array array['demo_sessions', 'cases', 'source_documents', 'source_chunks'] loop
    foreach permission_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if not has_table_privilege('service_role', 'public.' || table_name, permission_name) then
        raise exception 'Missing service_role % permission on %', permission_name, table_name;
      end if;
      foreach restricted_role in array array['anon', 'authenticated'] loop
        if has_table_privilege(restricted_role, 'public.' || table_name, permission_name) then
          raise exception 'Unexpected % access to %', restricted_role, table_name;
        end if;
      end loop;
    end loop;
    if not (select relrowsecurity from pg_class where oid = ('public.' || table_name)::regclass) then
      raise exception 'RLS disabled on %', table_name;
    end if;
  end loop;
end;
$$;
rollback;
