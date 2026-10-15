# AI-assisted case reading

Rewoven can read a source and suggest a case title, context, recorded outcome, and lessons. You review the suggestions before saving. Manual entry still works without an OpenAI key.

## Try it with one project

Suppose you have delivery notes for an expense approval portal. The notes describe manager approvals and an audit log, but contain no measured delivery outcome.

1. Open **Case library → Add case**.
2. Choose the PDF or paste the original notes.
3. Select **Read with AI**. This sends extracted source text to OpenAI and can incur API charges.
4. Review the suggested title and context. Expand **Supporting evidence** to see the source quotes and PDF page numbers.
5. Leave the outcome blank when no actual result is recorded. A goal such as “reduce approval time” is not a measured outcome.
6. Edit the title, then select **Confirm & add case**.
7. In the saved case, expand **AI reading record → View original AI suggestions**. Your edited title appears in the case description; the original suggestion remains in the reading record.
8. Follow an evidence link to inspect the original PDF at its cited page.

Refreshing retains a confirmed case. The library initially selects its default sample, so select your added case from the list after refreshing.

## Three different features

| Term          | Plain meaning                                                          | Current state    |
| ------------- | ---------------------------------------------------------------------- | ---------------- |
| AI extraction | Read a document and suggest fields for a person to review              | Implemented here |
| Embeddings    | Represent text with numbers so search can compare meaning              | Not implemented  |
| RAG           | Retrieve relevant evidence and give it to AI to help answer a question | Not implemented  |

Existing `source_chunks` are smaller pieces of extracted text. Their `search_vector` is PostgreSQL's keyword-search representation, not an AI embedding. This feature does not change the **Find past cases** preview into a working RAG flow.

## What happens when you click Read with AI?

```text
Browser: selected PDF or pasted notes
    ↓ POST /api/cases/analyze
Next.js server: check demo session, validate source, extract text by page
    ↓ Reserve an AI attempt, or reuse a completed reading
OpenAI: suggest structured fields and supporting quotes
    ↓
Next.js server: check field sizes, quotes, and page references
    ↓
Browser: show editable suggestions for review
    ↓ Confirm & add case → POST /api/cases
Supabase: save final fields, original source, and link to the AI reading
```

The **browser** is the page running on your computer. It handles typing, file selection, and buttons. The **Next.js server** handles requests from that page and calls Supabase and OpenAI using private keys. These keys never need to be sent to the browser.

A **Route Handler** is the server code behind an address such as `/api/cases/analyze`. The browser asks that address to read a source; it does not call OpenAI or Supabase directly.

The server uses the existing PDF reader to extract embedded text. OpenAI receives that text with page boundaries, not the PDF binary or a file-storage URL. Images and diagrams are not interpreted.

**Structured output** means the model must return a specific JSON shape. Each of the four fields has a `value` and an `evidence` list. An unsupported field has an empty value and no evidence. See [OpenAI's structured output documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

For every nonempty suggestion, the server checks that its quotes occur on the cited pages, allowing extraction whitespace differences. Non-PDF text uses `page: null`. A field may have up to three quotes, each at most 600 characters. Suggested titles are limited to 200 characters; other suggested fields to 2,000. Final user-entered fields keep the existing limits: 200 for the title and 5,000 for each other field.

**A matching quote does not prove that the AI interpreted it correctly.** Review the claim against its evidence. The prompt asks the model to ignore document instructions, preserve conflicts, and avoid turning planned benefits into recorded results; these instructions reduce mistakes but do not guarantee correctness.

## Your edits take priority

- AI fills blank fields and leaves your existing text intact.
- **Use suggestion** deliberately replaces one field with its AI suggestion.
- Editing a suggested field marks it as your text.
- Replacing the source clears untouched AI-filled values. Your edited and manually entered fields remain, with a reminder to review them against the new source.
- A failed AI reading leaves the source and form available for retry or manual entry.
- Confirmation is the only action that creates a case.

Closing and reopening the dialog preserves its in-memory draft while the page stays mounted. Refreshing loses unfinished sources and edits. Selecting the same original again and clicking **Read with AI** may reuse its cached suggestions; it does not restore your unsaved edits.

## What Supabase stores

A **fingerprint** is a SHA-256 identifier calculated from the exact source bytes and format. Changing either makes it a different source for AI review purposes.

| Record                              | Why it exists                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `case_ai_readings`                  | Session-owned reading status, fingerprint, model, prompt version, attempt count, suggestions, quotes, and extraction warnings |
| `case_ai_attempts`                  | One timestamp per reserved attempt, used to enforce session and daily limits                                                  |
| `case_ai_reviews`                   | Connects a confirmed case and its source to the original AI reading                                                           |
| Existing cases, sources, and chunks | Keep your final fields, original material, extracted pages, and keyword-search text                                           |

The preview does not store an uploaded original in Supabase. It stores the AI reading and its evidence snippets. Confirmation stores the original using the existing private bucket or pasted-text database field.

Completed readings cannot be updated. Your final fields are stored separately, so editing a suggestion before confirmation does not rewrite the AI draft. Case creation verifies that the analysis ID belongs to your session and matches the submitted original, then attaches the review in the same database transaction as the case and source records.

The new tables have RLS enabled and ordinary direct access revoked. The server still checks ownership because its Supabase secret key bypasses RLS. Shared sample cases remain read-only. The existing HttpOnly cookie identifies your anonymous 24-hour session; it is separate from Supabase Auth accounts.

Session expiry ends access. Automatic deletion of expired records, cached quotes, and files is not implemented.

## Important files

| File                                                                             | Purpose                                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Add a case dialog](../../src/features/cases/add-case-dialog.tsx)                | Source selection, explicit AI action, review, and confirmation                  |
| [Draft rules](../../src/features/cases/case-draft.ts)                            | Preserve user edits and clear outdated AI values when sources change            |
| [Analysis endpoint](../../src/app/api/cases/analyze/route.ts)                    | Check origin/session and accept a bounded upload                                |
| [Reading coordinator](../../src/features/cases/server/analyze-source.ts)         | Extract text, reserve attempts, reuse cached readings, and save results         |
| [OpenAI request](../../src/features/cases/server/openai.ts)                      | Server-only configuration, prompt, schema request, timeout, and provider errors |
| [Suggestion validation](../../src/features/cases/case-suggestions.ts)            | Shared types and checks for output sizes and real source quotes                 |
| [Source input](../../src/features/cases/server/source-input.ts)                  | Shared input validation and exact-original fingerprinting                       |
| [Case ingestion](../../src/features/cases/server/ingestion.ts)                   | Check the selected analysis and save the original with final fields             |
| [AI reading viewer](../../src/features/cases/ai-reading-record.tsx)              | Display the original suggestions separately from the final case                 |
| [Database migration](../../supabase/migrations/202610150003_case_ai_reading.sql) | Private reading records, atomic budget reservation, and review attachment       |

## Setup and run

Follow the [README setup](../../README.md#quick-start) first, including local Supabase credentials. Keep the existing `.env.local`; do not overwrite it when adding AI settings.

From the project root:

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:migrate
bun run db:seed
```

`db:start` needs OrbStack or Docker Desktop running. `db:migrate` applies pending migrations without resetting existing data. Seeding is optional for adding your own case; it provides the fictional library used in the walkthrough.

Add or confirm these server-only settings in `.env.local`:

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_CASE_MODEL=gpt-4.1-mini-2025-04-14
AI_CASE_SESSION_LIMIT=10
AI_CASE_DAILY_LIMIT=100
```

The model and limits have the defaults shown above, so only the API key is required for AI reading. Restart your development server after changing environment settings:

```bash
bun run dev
```

Open [the local case library](http://localhost:3000/case-library). If your app is already running with the right settings, use that server. Stop it with Ctrl+C when finished; Supabase stays running until `bun run db:stop`.

For a repeatable example, upload [the fictional three-page delivery notes](../../supabase/fixtures/delivery-notes.pdf). Follow the opening walkthrough. Expect editable suggestions and real page references, with the outcome left blank. Exact AI wording can vary.

## Costs, limits, and privacy

The default allowance is 10 reserved attempts during a demo session and 100 across the database per UTC day. The daily allowance resets at midnight UTC. Reservations are atomic, so concurrent workers cannot each spend the last available attempt.

Repeated readings of the same original, model, and prompt version reuse a successful result within the same session. Failed provider calls consume attempts too. Invalid source extraction is rejected before reserving an AI attempt. Set either limit to `0` to block new readings; existing cached results remain available.

These are **attempt limits, not a dollar budget**. Text length and model pricing affect actual charges. A request that times out locally may still incur provider charges. Configure provider billing controls separately.

Only one new reading can run in a session at a time. Provider requests time out after 60 seconds. If server work is interrupted, retry is allowed after the two-minute processing lease expires. A lease is a temporary claim that prevents two workers processing the same reading simultaneously.

Requests use `store: false`, which disables storing the response for later API retrieval. This does not promise zero provider retention; consult [OpenAI's data controls](https://developers.openai.com/api/docs/guides/your-data). Cached suggestions and quotes remain in your own database until explicitly cleaned up.

## Common errors

| Message or situation                                                | What to do                                                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| AI reading is not configured                                        | Set the server's `OPENAI_API_KEY`, restart Next.js, or enter fields manually                                     |
| Key cannot access AI reading                                        | Check the key and selected model's availability for your API account                                             |
| OpenAI usage limit reached                                          | Check provider billing/quota or wait; manual entry still works                                                   |
| Session or daily reading limit reached                              | Use manual entry; daily allowance returns at midnight UTC                                                        |
| A source is already being read                                      | Wait for completion; interrupted work can retry after two minutes                                                |
| Quote could not be verified                                         | Inspect the source, retry, or enter the details manually; the rejected output is not shown as a valid suggestion |
| Analysis does not match the source                                  | Read the current source again, or replace the source to clear its analysis and submit manually                   |
| PDF has no readable text, is encrypted, corrupt, or over the limits | Supply a supported text-based file or paste its text; no OCR or silent truncation is performed                   |
| Source storage is unavailable                                       | Check Supabase and apply pending migrations; preserve the draft while fixing the connection                      |

## Verification

With local Supabase and the web app running:

```bash
bun run test
bun run test:integration
bun run lint
bun run typecheck
bun run format:check
bun run build
```

The unit tests cover output validation, quote/page checks, safe provider failures, configuration, source fingerprints, and preservation of user edits. Integration tests create and clean up their own sessions, use fake model output, and make no OpenAI calls. They verify input formats, cache reuse, immutable results, source binding, session isolation/expiry, retries, processing leases, and atomic session/global limits.

The explicit live test makes one billable reading of a fictional PDF and checks cached reuse, reviewed fields, refresh persistence, and preserved original bytes:

```bash
bun run test:ai:live
```

The live test is local-only and is not part of the default test commands. The model must return a complete, grounded result for it to pass. It cleans up its test case, source, and session.

For production-mode local verification, build before starting the production server:

```bash
bun run build
bun run start --port 3001
```

In another terminal, target that server without repeating the live AI call:

```bash
TEST_BASE_URL=http://localhost:3001 bun run test:integration
```

Verified locally on 15 October 2026: 21 unit tests, both integration suites, formatting, lint, type checking, and the production build passed. One live OpenAI PDF reading passed. Browser checks covered editable suggestions, evidence, real save/refresh/source access, manual fallback, file selection/drop, simulated provider/network errors, keyboard focus, light/dark themes, 320/390px layouts, long filenames, and reduced motion. Browser failure scenarios and one full browser flow used controlled AI output to avoid extra paid calls. Development-only cache/reduced-motion notices were observed; no full screen-reader audit or hosted deployment verification was performed.

## What remains

There are no embeddings, semantic retrieval, RAG answers, reusable-artifact tags, diagram interpretation, OCR, saved plans, or resumable unfinished drafts. This increment has not been deployed. Prompt quality has been checked with a small fictional fixture set, not a broad accuracy evaluation; human review is required.
