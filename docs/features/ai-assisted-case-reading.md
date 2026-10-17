# AI-assisted case entry

The case-page refactor adds six structured, source-linked overview sections to staged reading. See [case overviews](case-overviews.md) for the current review editor, edited-claim provenance, refresh behavior, and prepared sample catalog. The original four metadata fields remain as compatibility projections.

Upload the documents from one historical project and let Rewoven suggest its title, context, recorded outcome, and lessons. You review and confirm the draft rather than typing those fields from scratch. The reader accepts the same material as ingestion: up to **5 MB and 500,000 extracted characters per document**, with **50 documents, 100 MB of originals, and 5,000,000 accepted extracted characters per case**.

For example, upload an SRS proposing automated notifications, meeting minutes postponing that feature, and a retrospective describing the manual approval flow that actually shipped. The reader processes all three documents and combines their supported findings. Planned features must remain distinct from delivered work; intended benefits must not become measured outcomes.

## Try the upload-first flow

1. Open **Case library → Add case** and select your files, or choose **Paste text**.
2. Select **Read documents with AI**. No case title or other metadata is required before this action. OpenAI API use is billed to the project's account.
3. Keep the dialog open while it uploads, extracts text, reads sections, and combines findings. Larger cases need multiple steps; each provider request can take up to a minute.
4. Review the filled-in fields. Expand **Supporting evidence** to inspect original quotes, document names, and physical PDF pages.
5. Edit anything that needs correction, or use **Use suggestion** to deliberately replace an existing field.
6. Select **Confirm case details**. Your final fields are saved separately from the original AI draft.
7. Expand **AI reading record** in the saved case to inspect the original suggestions and their sources.

If AI cannot establish a field from the documents, it stays blank. A title remains required when confirming; unrelated or unreadable material may require you to supply one. **Enter details yourself instead** is an optional fallback, including when no API key is configured.

Unlike the earlier inline reader, clicking Read now stores the original documents and creates a session-owned case before generating metadata. An unfinished case can appear as **AI reading in progress** until you confirm its details. Text extraction and semantic indexing remain independent of metadata review.

## Pause, refresh, and add documents

Closing the dialog pauses after the request already in progress; refreshing has the same effect. The server retains originals, extracted text, completed AI sections, and intermediate combinations. Unsaved edits in the form remain in memory and are lost on refresh.

Return to **Case library**, select the unfinished case, and choose **Read case with AI → Read all case documents**. It resumes saved work, or loads the completed draft without another provider call. The library may initially select its default fictional sample after refreshing; choose your own case from the list.

Use **Add documents** to extend an existing case. Selecting **Read documents with AI** there reads the existing sources and the newly uploaded material together. Alternatively, upload first, then choose **Read case with AI**. Previously saved metadata stays unchanged until confirmation. AI fills blank fields, keeps your existing text, and offers explicit per-field replacement through **Use suggestion**.

A warning identifies a reviewed reading that predates newly attached documents. Source changes invalidate the old reading for confirmation. A fresh reading is keyed to the complete source snapshot, model, and reader version. It creates a new draft without rewriting completed reading records or silently replacing your corrections.

## Local setup

Use the Node.js and Bun versions described in the README. Start your Docker-compatible runtime and preserve an existing ignored `.env.local`.

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:migrate
bun run dev
```

Configure local `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `OPENAI_API_KEY` in `.env.local` using the README. These credentials stay on the server. Optional settings are:

```dotenv
OPENAI_CASE_MODEL=gpt-4.1-mini-2025-04-14
AI_CASE_SESSION_LIMIT=50
AI_CASE_DAILY_LIMIT=100
```

Open the URL printed by Next.js, usually `http://localhost:3000`. Stop Next.js with Ctrl+C; Supabase keeps running. `bun run db:stop` stops its containers and retains local data. For production testing, run `bun run build` before `bun run start`; the production server needs the compiled output.

The additive migration `202610160003_staged_case_reading.sql` adds resumable work to existing reading records and transactional review functions. It does not reset existing cases, evidence, or completed readings. Apply it to an existing local database with `bun run db:migrate`; use the established deployment workflow for hosted Supabase.

## How a larger case is read

```text
Select documents → reserve private source paths → upload directly to storage
    ↓
Extract original text in saved stages, keeping physical page numbers
    ↓
Read up to 32 original excerpts per AI step (at most 19,200 characters)
    ↓
Combine up to four partial drafts at a time, retaining original evidence
    ↓
Show a complete editable draft → confirm → save reviewed case fields
```

The 500,000-character limit controls accepted document text, not one giant prompt. Every readable excerpt is assigned to a reading step. Completed steps are checkpointed before the next request. Combinations form a bounded hierarchy rather than sending hundreds of partial drafts in one request. A failed call retries from the last saved checkpoint; an in-flight call with an uncertain response can be billed again if retried.

The browser drives the loop through Next.js Route Handlers. Each `/api/cases/:id/read` request advances at most one provider step. This is resumable foreground processing, not a background worker that continues scheduling after the app closes. Existing source extraction also resumes through its own bounded endpoint.

OpenAI returns structured fields and selects excerpt IDs. The server resolves those IDs to actual source quotes and page locations. During combination it keeps the original source identity, including when two documents use the same page number. The model does not generate the displayed quote text or citation locations. See [OpenAI's structured output documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

If one field has unverifiable evidence, the staged reader clears that field and adds a review note while retaining independently validated fields. Empty fields discard dangling citation IDs. Fabricated quotes or unknown IDs never become accepted evidence.

Each field can cite up to three quotes of at most 600 characters. Suggested titles are limited to 200 characters; other suggested fields to 2,000. Final edited fields retain their existing limits of 200 and 5,000 respectively. A matching quote proves that the quote exists, not that the model interpreted it correctly; review factual claims against the evidence.

## Data, ownership, and review

- `case_ai_readings` stores the source snapshot, model, reader version, work cursor, partial drafts, errors, and completed result. Completed records remain immutable.
- `case_ai_attempts` meters whole-case reading attempts. One successful run can make multiple bounded provider calls while using one attempt. Retrying a failed run uses another attempt and preserves its checkpoints.
- `case_ai_reviews` points a confirmed case to its reviewed draft. Each evidence item retains its own source ID; the legacy single-source relationship remains compatible.
- Confirmation checks ownership, current source versions, and the previous case field values in one transaction. A concurrent change produces a conflict instead of overwriting someone else's saved details.

All routes use the existing HttpOnly demo-session cookie. Direct browser database access remains blocked; server keys and provider keys remain private. Shared fictional samples remain read-only. Sessions last 24 hours. Expiry ends access; automatic deletion of expired data and originals is still not implemented.

Development (`bun run dev` / `bun run devx`) keeps the existing unlimited attempt policy. Production defaults to 50 attempts per session and 100 per UTC day, including legacy inline readings. Deployment variables override those defaults; zero blocks new attempts. A successful cached result remains reusable. These are run-attempt limits, not model-call or monetary budgets. Provider billing and rate limits still apply. Embedding token budgets remain separate.

## Important code and APIs

- `src/features/cases/server/case-reading.ts` plans sections, resumes model steps, combines evidence-backed drafts, and validates review saves.
- `src/features/cases/read-case.ts` drives preparation and reading from the browser; `add-case-dialog.tsx` handles upload-first entry and editable review.
- `src/features/cases/server/openai.ts` owns provider requests and strict output validation; `source-evidence.ts` resolves excerpt IDs to originals.

`POST /api/cases/:id/read` returns progress and a completed draft when ready. `POST /api/cases/:id/review` confirms edited fields against the original metadata snapshot. `PATCH /api/cases/:id` preserves manual fallback for a case created during an interrupted reading. The older multipart `/api/cases/analyze` route remains compatible for inline sources up to 50,000 characters; it is no longer the browser's AI intake path. Larger documents and complete 5 MB uploads use stored sources through the new route.

## Verification and boundaries

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
# With local Supabase and an application server running:
bun run test:integration
# Optional, billable: reads fictional sources including a document over 50,000 characters:
bun run test:case-reading:live
```

Automated checks cover a full 500,000-character document with another source, full section coverage, checkpoint recovery, source-specific citations, cached reuse, separate reviewed edits, session isolation, and rejection of stale or concurrent review saves. Unit tests cover bounded draft combinations and restoration of physical PDF pages across sources. The existing ingestion, retrieval, and inline-reading regressions remain in the suite.

Local verification on 16 October 2026: 46 unit tests and 8 integration tests passed, along with formatting, lint, TypeScript, and a production build. A live OpenAI run read all 6 sections from three fictional documents, including an SRS above 50,000 characters, and retained original citations. Browser verification uploaded a PDF and Markdown document with no manually entered title, reviewed the filled draft, saved the case, and checked the intake dialog at a 390-pixel mobile width. This does not establish factual quality for arbitrary client documents or performance at the complete case quota.

PDF support remains embedded text only: no OCR, diagrams, image interpretation, or complex-layout reconstruction. All documents must finish text extraction before the complete case can be read; extraction failures are disclosed rather than silently omitted. The output is four editable case fields, not the richer purpose/users/features overview, request comparison, or reuse plan. Maximum-capacity timing, multilingual factual quality, and hosted deployment behavior need separate verification.
