# Understanding the case library and source ingestion

Rewoven can now store past projects, let you inspect their original documents, and accept new cases. This guide explains that implementation using a small example. AI analysis and reuse-plan generation are still future work.

## Start with a concrete example

Imagine your team built a vendor billing portal. You have delivery notes explaining that finance reviewed invoices and that each approval recorded a reviewer and timestamp.

1. Open **Case library**, then **Add case**.
2. Enter `Vendor Billing Portal` as the title.
3. Choose **Paste text** and paste the delivery notes, or choose **Upload file** and select a supported file.
4. Add context if it helps. Leave the outcome blank if nobody recorded one.
5. Select **Add case**.

Rewoven stores the original material, extracts readable text, and prepares that text for keyword search. A successful case becomes **Ready** and appears in the library. You can select it, inspect its text, and open or download the original.

A blank outcome stays **Outcome not recorded**. The application does not invent a success story from the fact that a project exists.

For the loading placeholders and request transitions, see [Understanding loading states and skeletons](loading-states.md).

## How the pieces work together

The **browser** handles typing, selection, the dialog, and progress feedback. The **Next.js server** validates requests, checks ownership, and processes documents. **Supabase** supplies two different services: a database for structured records and Storage for uploaded files.

```mermaid
flowchart LR
  Browser[Add a case in the browser] --> Server[Next.js Route Handler]
  Server --> Database[(Cases and source records)]
  Server --> Storage[(Original uploaded files)]
  Storage --> Extract[Extract readable text]
  Extract --> Database
  Database --> Library[Library and source viewer]
```

A **Route Handler** is a server function reached through an HTTP address. For example, submitting the dialog sends a `POST` request to `/api/cases`. The server, rather than the browser, talks to Supabase using its secret key.

The workspace page remains a **Server Component**, which provides the page frame and metadata. Interactive components run in the browser because they need event handlers and state. The PDF parser and database credentials stay on the server.

### Why the database has several tables

| Table              | What it remembers                                                            | Why it is separate                                                  |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `demo_sessions`    | A session identifier, token hash, and expiry                                 | Establishes who may access personal additions.                      |
| `cases`            | Title, context, outcome, lessons, and processing status                      | Describes the project independently of a particular document.       |
| `source_documents` | Original text or file location, extracted text, pages, warnings, and version | Keeps evidence and its origin available for inspection.             |
| `source_chunks`    | Smaller text pieces, their locations, and search indexes                     | Makes source text searchable while retaining its document and page. |

An uploaded PDF is kept unchanged in the private `case-sources` bucket. Its extracted text is a different representation stored in the database. Pasted text is retained directly in the database instead of creating an uploaded file.

A **chunk** is a piece of text of up to 2,000 characters. PDF chunks stay within their original page and keep that page number. This increment uses PostgreSQL keyword search; it does not create embeddings or ask an AI model to choose relevant cases.

### What happens after you select Add case

1. Validate the title, optional fields, source format, and input limits.
2. Reserve one case and its source record together, initially **Processing**.
3. Store an uploaded original if the source is a file.
4. Extract text. For PDFs, read embedded text page by page using `unpdf`.
5. Validate the extracted length and record pages without readable text.
6. Save extracted text and chunks, then mark the case **Ready** in one database transaction.

A **transaction** groups database changes so they either finish together or are rolled back. It prevents a case from becoming Ready before its searchable content has been saved.

If extraction fails, the case becomes **Failed** with an explanation. The retained original remains available. **Retry processing** uses the same case and source; it does not create another case. Retrying an image-only PDF will still fail until you provide readable evidence through a new case.

Processing runs within the HTTP request, without a background queue. Each attempt claims a processing token. An active claim cannot be taken over for two minutes; after that, an interrupted attempt can be retried. A token check prevents an older attempt from overwriting a newer result.

The form also sends a stable request identifier. Repeating the same submission after a lost response returns the existing case. Changing the form starts a new submission.

## How demo sessions protect additions

No account is required. The server creates a random token and puts it in an **HttpOnly cookie**, which browser JavaScript cannot read. The database stores a hash of that token, rather than the token itself.

Every library, detail, retry, and original-file request resolves that cookie to an unexpired server-side session. The server decides ownership; an owner ID supplied by the browser has no authority.

Shared fictional samples are visible to everyone and read-only. Your additions are visible only within your browser's demo session. Sessions last 24 hours from creation, and refreshes do not extend that expiry. Tabs in the same browser profile normally share the session; a separate browser profile or private window gets a different one.

**Row Level Security (RLS)** is also enabled in the database. Anonymous and ordinary authenticated database roles have no access to these tables or processing functions. The server's privileged key bypasses RLS, so explicit ownership checks in the server remain essential. Original files are served through an ownership-checked endpoint, without publishing the bucket.

Expiry ends access through the application. It does not currently delete expired database records or uploaded files automatically. Automated data cleanup is not implemented.

## Important files

Read these in this order if you want to follow the implementation:

| File                                                                | What to look for                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [case-library.tsx](../../src/features/cases/case-library.tsx)       | Loading the session, search results, selection, and processing updates.       |
| [add-case-dialog.tsx](../../src/features/cases/add-case-dialog.tsx) | Form state, file selection/drop, validation, and submission.                  |
| [ingestion.ts](../../src/features/cases/server/ingestion.ts)        | Bounded uploads, original storage, processing claims, and completion/failure. |
| [extraction.ts](../../src/features/cases/extraction.ts)             | UTF-8 decoding, PDF pages, warnings, and source chunks.                       |
| [repository.ts](../../src/features/cases/server/repository.ts)      | Ownership-scoped reads and keyword search.                                    |
| [session.ts](../../src/features/cases/server/session.ts)            | Cookie creation, expiry checks, and session lookup.                           |
| [source-viewer.tsx](../../src/features/cases/source-viewer.tsx)     | Document tabs, PDF page controls, and original-file links.                    |
| [migrations](../../supabase/migrations/)                            | Tables, access restrictions, indexes, and transactional processing functions. |
| [seed-cases.ts](../../scripts/seed-cases.ts)                        | Repeatable local import of ten fictional cases and their real source files.   |

The HTTP interface is deliberately small:

| Method and address              | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `POST /api/demo-session`        | Reuse an active session or start a new one.     |
| `GET /api/cases?q=approval`     | List accessible cases or search Ready cases.    |
| `GET /api/cases/:id`            | Read a case and its sources.                    |
| `POST /api/cases`               | Add one case from multipart form data.          |
| `POST /api/cases/:id/retry`     | Retry retained evidence on your case.           |
| `GET /api/sources/:id/original` | Open an original PDF or download original text. |

## Run it and try the workflow

From the repository root, with your Docker-compatible runtime running:

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:status
```

For first-time configuration, copy `.env.example` to `.env.local` only if that local file does not exist. Set `SUPABASE_URL` to the local API URL and `SUPABASE_SECRET_KEY` to the local secret key shown by `db:status`. See the [README quick start](../../README.md#quick-start). Keep the secret in `.env.local`, not in browser code.

Then apply the schema and load the examples:

```bash
bun run db:migrate
bun run db:seed
bun run dev
```

`db:migrate` applies pending local migrations without resetting existing data. `db:seed` imports the original files as well as database records, and preserves existing Ready seeds on reruns. The seed script deliberately accepts only a local Supabase URL.

Open [the local library](http://localhost:3000/case-library), or use the port printed by Next.js. Try this walkthrough:

1. Select **Expense Approval Portal**. It should have two sources and an unknown outcome.
2. Select **Delivery notes.pdf**, advance to page 3, and read the single-manager approval description.
3. Select **Open original PDF**. It should open the actual PDF at the selected page, subject to your browser's PDF-viewing support.
4. Switch to **retrospective.md** to inspect its permission checklist.
5. Add the vendor billing example described at the start of this guide.
6. Refresh, then select your case again. Its source should still be available.
7. Search for a distinctive word from that source. The Ready case should appear.
8. Open a private window. It should show the shared samples without your addition.

Stop Next.js with **Ctrl+C**. Supabase keeps running; `bun run db:stop` stops it while preserving local data. On later days, `bun run devx` starts Supabase and Next.js together. Reapply migrations after pulling schema changes; startup does not apply pending migrations to an existing database.

To inspect the production build, use:

```bash
bun run build
bun run start --port 3001
```

The build prepares the optimized application; `start` serves that output. Open [the production-mode local library](http://localhost:3001/case-library). No AI key is needed for this feature.

### Input limits and recovery

| Situation                             | What to do                                                           |
| ------------------------------------- | -------------------------------------------------------------------- |
| Unsupported file                      | Use UTF-8 `.txt`/`.md`, embedded-text `.pdf`, or paste text.         |
| File above 5 MB                       | Choose a smaller file. The application limit is 5,000,000 bytes.     |
| More than 50,000 extracted characters | Split the document. Rewoven does not truncate it silently.           |
| Scanned or image-only PDF             | Provide a text-based PDF or paste the content; OCR is not included.  |
| Password-protected/corrupt PDF        | Export an unlocked, valid text-based PDF or paste the text.          |
| Some PDF pages contain no text        | Read the page warnings; images on those pages are unavailable.       |
| Storage not configured or unavailable | Check `.env.local`, start Supabase, apply migrations, and try again. |
| Request fails while adding            | The form stays available. Retry without retyping the evidence.       |
| Processing was interrupted            | After two minutes, use **Retry processing** on the retained case.    |

A title is required and limited to 200 characters. Context, outcome, and lessons are optional, each limited to 5,000 characters. Each submission accepts one source. Uploaded originals and pasted source material remain version 1; editing, replacing, or deleting evidence is not exposed in this interface.

## Verification and current limits

Run focused tests and the repository checks:

```bash
bun run test
bun run lint
bun run format:check
bun run typecheck
bun run build
```

With Supabase configured, seeded, and Next.js running, also run:

```bash
bun run test:integration
```

The integration command defaults to port 3000. To test the production server above:

```bash
TEST_BASE_URL=http://localhost:3001 bun run test:integration
```

The integration suite creates its own sessions and removes their records and uploaded files afterward. It uses local server credentials to simulate expiry and interrupted processing. Run it against your configured local Supabase environment.

Verified locally on 15 October 2026:

- Eight unit tests cover validation, UTF-8 handling, PDF page extraction, empty pages, encrypted/corrupt/over-limit PDFs, chunk locations, and session tokens/expiry.
- The live API suite covers persistence, duplicate submissions, keyword search, failed/active/interrupted processing, expired sessions, sample protection, cross-session access, and anonymous database/storage denial. It passed against development and production servers.
- Browser checks cover paste, native file selection, drag-and-drop, PDF pages, failed extraction/retry, source switching, refresh persistence, source search, dialog focus/Escape, and form preservation after a simulated server failure.
- Light/dark themes, reduced motion, and widths of 390px and 320px were checked. Formatting, lint, type checking, and production compilation passed.

The deliberately simulated 503 appeared in the browser console as expected. Chromium also logged a transient `aria-hidden` focus warning during rapid dialog reopening; explicit initial-focus and focus-restoration checks passed. A screen-reader audit has not been performed.

This is a locally verified feature, not a verified hosted deployment. Hosted migrations, seed provisioning, upload limits, and runtime behavior still need deployment-specific verification. There is no OCR, AI analysis, semantic retrieval, saved-plan persistence, automatic expiry cleanup, or source editing in this increment.
