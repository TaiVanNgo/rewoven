create table public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.demo_sessions(id) on delete cascade,
  is_seed boolean not null default false,
  request_key uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  context text not null default '' check (length(context) <= 5000),
  outcome text not null default '' check (length(outcome) <= 5000),
  lessons text not null default '' check (length(lessons) <= 5000),
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error_message text,
  processing_started_at timestamptz not null default now(),
  processing_token uuid,
  created_at timestamptz not null default now(),
  constraint case_ownership check ((is_seed and session_id is null) or (not is_seed and session_id is not null)),
  unique (session_id, request_key)
);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  format text not null check (format in ('text', 'txt', 'md', 'pdf')),
  version integer not null default 1 check (version > 0),
  original_text text,
  storage_path text,
  extracted_text text,
  pages jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check ((original_text is not null) <> (storage_path is not null))
);

create table public.source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.source_documents(id) on delete cascade,
  ordinal integer not null,
  page_number integer,
  char_start integer not null,
  char_end integer not null,
  text text not null,
  search_vector tsvector generated always as (to_tsvector('english', text)) stored,
  unique (source_id, ordinal)
);

create index cases_session_idx on public.cases(session_id);
create index documents_case_idx on public.source_documents(case_id);
create index chunks_source_idx on public.source_chunks(source_id);
create index chunks_search_idx on public.source_chunks using gin(search_vector);

alter table public.demo_sessions enable row level security;
alter table public.cases enable row level security;
alter table public.source_documents enable row level security;
alter table public.source_chunks enable row level security;
-- Access is exclusively through the server. No anon/authenticated policies.
revoke all on public.demo_sessions, public.cases, public.source_documents, public.source_chunks from anon, authenticated;

create function public.search_cases(p_session_id uuid, p_query text default '')
returns setof public.cases language sql stable security invoker set search_path = '' as $$
  select c.* from public.cases c
  where (c.is_seed or c.session_id = p_session_id)
    and (trim(p_query) = '' or (c.status = 'ready' and (
      to_tsvector('english', c.title || ' ' || c.context || ' ' || c.outcome || ' ' || c.lessons)
        @@ plainto_tsquery('english', p_query)
      or exists (
        select 1 from public.source_documents d join public.source_chunks ch on ch.source_id = d.id
        where d.case_id = c.id and ch.search_vector @@ plainto_tsquery('english', p_query)
      )
    )))
  order by c.is_seed asc, c.created_at desc, c.title;
$$;
revoke execute on function public.search_cases(uuid, text) from public, anon, authenticated;
grant execute on function public.search_cases(uuid, text) to service_role;
