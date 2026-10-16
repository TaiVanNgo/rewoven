# Multi-document cases and semantic retrieval

Imagine one historical project with `SRS.pdf`, `meeting-minutes.md`, and `retrospective.txt`. Add them to one case. Rewoven keeps each original separately, extracts its text, and makes source passages searchable. Later, describe a new project on **New request** and choose **Find past cases**. Results contain up to three cases with original excerpts and links that open the matching document location.

Retrieval returns original evidence. [AI-assisted case entry](ai-assisted-case-reading.md) now combines metadata from multiple documents in saved stages. Richer project overviews, generated project comparisons, advice, saved plans, and client request attachments remain future work.

## Run it locally

Use Node.js 20.19+ and the Bun version in `package.json`. Start your Docker-compatible runtime first. Follow the README to configure ignored `.env.local` with local Supabase credentials; set `OPENAI_API_KEY` there for embeddings. Never put the server key in browser code.

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:migrate
bun run db:seed
bun run db:backfill
bun run dev
```

Open the URL printed by Next.js, usually `http://localhost:3000`. In **Case library**, choose **Add case**, select files, enter a title, and confirm. Use **Add documents** in an existing case to extend it. Uploads run two at a time. Keep the dialog open while originals are uploading; after that, processing advances while Case library is mounted. Leaving or closing the page pauses further steps. Return to resume. A request already running can finish after you leave.

Stop Next.js with Ctrl+C. Supabase keeps running; `bun run db:stop` stops its containers and preserves local data. For production testing run `bun run build` before `bun run start`; the server needs the compiled output.

## What is stored and why

One case has multiple immutable source documents. Each source has its own upload, extraction, and indexing states. Extracted chunks retain source ID, physical PDF page, and exact UTF-16 character offsets. Original text and files remain separate from model suggestions.

The first Ready source makes the case usable. A failed PDF does not remove successful meeting notes. Extraction failure means that source is excluded from search. Embedding failure leaves extracted text available for keyword search and exposes **Retry this document**. Coverage warnings explain incomplete indexing.

Limits are decimal 5 MB per file, 500,000 UTF-16 characters per source, 50 retained sources, 100 MB of originals, and 5,000,000 accepted extracted characters per case. Pasted text counts toward both original-byte and extracted-character totals. The server serializes cumulative quota decisions, including concurrent upload reservations. There is no silent truncation. OCR, image interpretation, `.docx`, automatic version replacement, and deleting retained documents remain outside this milestone.

## Browser → server → storage → index

- The browser creates a case and reserves each source through authenticated Next.js Route Handlers. The session cookie establishes ownership; no client-supplied owner is trusted.
- The server returns a signed capability for one immutable path in the private `case-sources` bucket. File bytes go directly from the browser to Supabase. This avoids Vercel's function payload ceiling for both 5 MB uploads and original downloads.
- Completion validates the stored original against its byte reservation. Interrupted uploads can be resumed by reselecting the same filename and size. Signed upload capabilities last two hours; expired reservations are reconciled when adding documents. Retained originals continue to count toward quotas.
- The library drives checkpointed processing. PDFs advance at most ten pages per step. Final extraction publishes exact chunks and enforces the total accepted-text quota transactionally. Empty PDF pages produce warnings.
- Indexing sends up to 16 passages per request to OpenAI's `text-embedding-3-small` model, storing 1,536-dimensional vectors in pgvector. Each passage is at most 2,000 characters. Completed chunks and embeddings survive retries.

The route files under `src/app/api/` define HTTP endpoints using Next.js file-based routing. Client Components own upload selection, progress, and search interactions. Supabase credentials, processing, and provider calls stay in server-only modules. Case details contain source metadata; source text loads in segments of at most 10,000 characters so larger cases do not send every document on each refresh.

Important implementation areas:

- `src/features/cases/server/sources.ts`: ownership, reservations, completion, checkpoint processing, and source segments.
- `src/features/retrieval/server/retrieve.ts`: request validation, embeddings, hybrid search, grouping, and coverage warnings.
- `supabase/migrations/202610160002_multi_source_retrieval.sql`: statuses, quotas, leases, vectors, metered budgets, and permission-filtered search.

## How matching works

The request remains limited to 10,000 characters, with at most 1,000 per optional constraint. Rewoven embeds bounded pieces of the request and combines them into a normalized, length-weighted query vector. SQL runs exact cosine search and English keyword search over authorized Ready source passages. Equal-weight reciprocal rank fusion combines the leading 30 candidates from each branch using `k = 50`.

Hybrid results require cosine similarity of at least 0.40, an initial heuristic rather than a confidence probability. Cases are ordered by their strongest passage, with at most three passages per case. The system may return fewer than three cases or none. Missing query embeddings produce an explicitly labelled keyword-only fallback. Sources still awaiting embeddings can appear in that fallback but are excluded from semantic ranking. Existing outcomes remain contributor-supplied; missing outcomes stay visible.

Search returns original passages rather than generated factual claims. A matching SRS requirement alone does not establish that a feature shipped. Open the accompanying retrospective or other evidence before drawing that conclusion.

## Backfill and operating limits

```bash
bun run db:backfill
# Makes billable OpenAI calls; resumes missing embeddings without replacing chunks:
bun run db:backfill --embed
```

The first command fills missing original byte sizes without AI calls. The second also indexes Ready sources in shared fictional samples and active sessions. Expired session sources are skipped for indexing. A hosted run additionally requires `--project-ref=<matching hosted project reference>` with the intended server environment already configured. No migrations, builds, or fixture seeding call an AI provider.

These optional server-only settings bound embedding use separately from AI-reading attempts:

```dotenv
EMBEDDING_SESSION_TOKEN_LIMIT=2000000
EMBEDDING_DAILY_TOKEN_LIMIT=10000000
```

They apply to indexing and query embeddings. Budget reservation uses a conservative UTF-8 byte bound and settles to reported provider token usage on success. Failed or uncertain calls retain their reservation to avoid undercounting potentially billed work. Reaching a budget pauses indexing; the original and keyword search remain available. The daily window resets at midnight UTC; a session budget lasts for that session.

**Read documents with AI** accepts the same 500,000-character per-document and 5,000,000-character per-case limits. It reads saved sources in bounded stages and combines supported findings for review. This replaces the browser's earlier 50,000-character single-source path. See the [AI-assisted case entry guide](ai-assisted-case-reading.md) for setup, recovery, and separate attempt limits.

## Verification and limitations

`bun run test` covers extraction, exact offsets, long documents, vector pooling, and grouping. `bun run test:integration` checks local database/API persistence, full 5 MB direct storage transport, partial failure, session isolation, concurrent quotas, retry, and mocked embeddings. It makes no live OpenAI calls. See `tests/multi-source.integration.ts` for the recovery scenarios.

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
# With local Supabase and the application running:
bun run test:integration
```

Exact vector search is appropriate for the initial demo corpus; larger datasets need measured query latency before selecting an approximate index. Multilingual relevance and maximum-capacity processing speed are not promised. Real model relevance requires the separate billable evaluation command documented in the README. Local success does not verify a hosted Vercel/Supabase deployment.

Verification on 16 October 2026 passed formatting, lint, type checking, a production build, 43 unit tests, and seven integration tests. A live evaluation over the fictional samples found the expected case in the top three for 10 of 10 labelled requests; both unrelated requests returned no matches. Browser checks covered a two-file upload, a later pasted document, semantic results, citation highlighting, and a 390-pixel mobile layout. These are fixture/demo checks, not measured organizational relevance or maximum-capacity benchmarks.
