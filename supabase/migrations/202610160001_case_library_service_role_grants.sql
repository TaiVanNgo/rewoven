-- Hosted projects need not share the CLI's default table privileges.
-- The application accesses these tables only through its server key.
grant usage on schema public to service_role;
revoke all on table public.demo_sessions, public.cases,
  public.source_documents, public.source_chunks from public, anon, authenticated;
grant select, insert, update, delete
  on table public.demo_sessions, public.cases,
  public.source_documents, public.source_chunks to service_role;
