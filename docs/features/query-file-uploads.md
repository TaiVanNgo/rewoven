# Query file uploads

Imagine a client sends a purchase-approval brief and a separate technology checklist. In **Ask Wren**, choose **Upload files**, select both, and choose **Send**. No typed message is required. Wren reads the requirements, finds relevant cases within your current case selection, and explains what matches and what needs adapting. A request document describes proposed work; a historical case records past work. Their citations remain distinct.

## Set up and try it

Use the README's Node.js and Bun versions, start your Docker-compatible runtime, and configure ignored `.env.local` with local Supabase credentials and `OPENAI_API_KEY`.

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:migrate
bun run db:seed
bun run dev
```

`db:start` provisions both private storage buckets. Existing installations should rerun it after pulling this feature. `db:migrate` adds request documents, processing checkpoints, transactional quotas, and saved-plan request references. `db:seed` installs fictional historical examples without AI calls. Use `bun run devx` instead of `dev` to also start the database.

1. Open the URL printed by Next.js, usually `http://localhost:3000`.
2. Keep the default Case library scope to discover relevant projects across the nine preloaded projects and your own historical cases. **Add cases** is optional and narrows the search to specific projects.
3. Choose **Upload files**, or drop files onto the composer. Add a brief and supporting checklist. Type a question if useful, then choose **Send**. Selecting a file alone does not start AI processing.
4. Watch each file's upload, extraction, and reading progress. Wren starts comparison after the accepted files finish reading; there is no mandatory request-review screen.
5. Open a numbered reference to inspect its original PDF page or highlighted text. Request citations say **Request document**; historical citations retain the case title.
6. Send a follow-up with or without more files. Earlier active documents remain available even after their original messages fall outside the recent-message window.
7. Expand **Problem documents** to exclude or restore a file for future replies. Exclusion preserves originals and references in earlier turns. If a turn fails, **Retry this turn** keeps its original case and file snapshot.
8. Choose **Draft reuse plan** when ready. The existing request review remains part of plan creation. Active document findings and original passages inform preparation and generation. Exported Markdown contains a separate **Request document references** section.

Stop Next.js with Ctrl+C; use `bun run db:stop` to stop Supabase while preserving data. For production verification, run `bun run build`, then `bun run start --port 3001`. Building first creates the compiled application required by the production server. The existing Vercel production build applies migrations and provisions both buckets; a local check does not establish hosted deployment behavior.

## How the files work

- `src/features/queries/query-workspace.tsx` connects the message composer, historical case selection, and request documents. This is a Client Component because it handles typing, file selection, upload progress, and browser events.
- `src/features/query-files/` contains file controls, upload orchestration, document types, reference validation, and server-only processing. The extraction utilities reuse existing PDF/TXT/MD support. Uploaded bytes travel directly to signed private storage URLs; API calls send metadata and advance checkpoints.
- `src/app/api/query-files/` provides owned upload, completion, processing, inclusion/exclusion, preview, and original-file routes. Next.js maps each `route.ts` folder to an HTTP endpoint. Service credentials and model calls stay on the server.
- `supabase/migrations/202610170009_query_files.sql` creates the isolated document records, attempt accounting, and processing functions. `202610170010_plan_request_evidence.sql` retains the passages used during plan generation. `supabase/config.toml` declares the private `query-files` bucket.

Each document retains immutable original bytes, extracted pages, text offsets, processing progress, and source-linked findings. PDF extraction advances ten pages at a time. Reading advances twenty excerpts at a time and combines at most four intermediate findings sets. Completed stages are saved; retry does not reread them. Summaries help find cases, while original excerpts support displayed claims. Both request and historical evidence are limited to selected passages on each answer, rather than sending every original document repeatedly.

The database serializes reservations and context changes within a conversation. Each turn freezes its enabled document IDs alongside the existing case-selection snapshot. Request documents have their own table and bucket and never enter historical search or automatically create a case. Ownership and session expiry are checked for processing, previews, original downloads, and plan creation. Browser database roles cannot read these records directly.

## Limits and recovery

Accept UTF-8 `.txt`, `.md`, and text-based `.pdf`: up to **five files per message**, **twenty retained files per chat**, **5,000,000 bytes per file**, **500,000 extracted characters per document**, and **5,000,000 extracted characters per chat**. Retained originals also have a 100 MB chat ceiling. Excluded files still count toward retained-file, storage, and extracted-text quotas; start a new chat when a retained-material limit is reached. Files are never silently truncated.

Failed or incomplete enabled files block comparison and plan preparation. Retry reading, exclude the file, or upload a corrected document. Missing PDF text pages are disclosed and require exclusion of that incomplete document before comparison. Scans need OCR, which is not supported. Corrupt, password-protected, non-UTF-8, empty, and oversized files receive recovery guidance. A missing original upload requires selecting the file again or excluding its reservation. Upload progress survives in the saved chat, but browser `File` objects and unsent selections reset on reload.

An interrupted server stage can finish after navigation. Reopen the chat to inspect progress; an abandoned processing lease becomes retryable after two minutes. Chat-turn leases retain their existing five-minute behavior. Request source links require the original active 24-hour demo session. Expiry ends access; it does not automatically delete stored files. Exported excerpts remain readable independently of those links.

Document reading uses the existing chat model configuration. Its production attempt budgets are separate from chat turns and plan stages:

```dotenv
AI_QUERY_FILE_SESSION_LIMIT=50
AI_QUERY_FILE_DAILY_LIMIT=100
```

Each reading or combining model call reserves an attempt. Failed or uncertain calls keep their reservation; completed checkpoints require no further calls. Zero pauses new model stages. Development disables these attempt limits. Restart Next.js after environment changes. These are attempt ceilings, not monetary guarantees; actual reading calls depend on document length. A retained-text limit does not guarantee that an entire chat can be prepared within the default production attempt budget.

## Verification

```bash
bun run test
bun run lint
bun run format:check
bun run typecheck
bun run build
# With the application and local Supabase running:
bun run test:integration
```

The request-file integration test uses mocked AI responses and real local storage/database operations. It covers complete reading beyond 50,000 characters, a requirement near a document's end, checkpoint retry, file-only answers without historical matches, session isolation, PDF gaps, immutable turn snapshots, saved-plan references, and export. Existing extraction tests cover corrupt, scanned, encrypted, non-UTF-8 and over-limit sources. Browser verification should also check upload selection, file-only Send, follow-ups, source inspection, exclusion/restoration, keyboard access, narrow layouts, themes, and reduced motion. Full-capacity latency and hosted deployment behavior require separate measurements.
