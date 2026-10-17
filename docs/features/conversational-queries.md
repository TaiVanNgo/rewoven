# Ask Wren about past work

The request form now opens a saved conversation. Wren can answer questions about a specific case, find related cases, and compare past work with the request. Answers distinguish recorded facts, inferences, recommendations, and missing information, with links back to original source passages.

## Try a concrete example

1. Open **New request**, choose **Review delivery runs**, and select **Find past cases**.
2. The submitted request appears above a conversation, alongside up to three ranked case candidates. Ask: “What happened in Harbor Route Planning Pilot, and what changes if every depot needs it?”
3. Wren should explain only what the available source excerpts support. For the fictional Harbor case, the recorded improvement covers two pilot depots and ten observed business days. Wren should preserve that limit rather than claim company-wide results. Treat suggestions for a broader rollout as recommendations or inferences.
4. Select a citation to open the library at its source, PDF page where available, and character range. The exact excerpt is retained with the conversation.
5. Select **Ask Wren** on a result to focus the next question on that case. **Find related**, or asking for similar cases while focused, searches for other cases, excluding the reference case from results. Its original excerpts still support the comparison. **Search all cases** removes the explicit case filter; name a case or describe a new capability in your next question to change topics.
6. Return through **Recent queries**, or reload the query URL. Messages, submitted constraints, evidence, and the latest submitted focus remain available during the same demo session.

**Ask Wren about this case** in library details opens a focused request form. It does not generate an answer until you submit. **Edit query** copies the original request into the form and creates a separate conversation on submission. **New request** opens a blank form. Unsubmitted drafts are not stored in the database and reset on reload.

## Run it locally

Use the Bun and Node versions specified in the README and `package.json`. Preserve an existing `.env.local`.

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:migrate
bun run db:seed
bun run devx
```

`db:start` starts local Supabase and provisions its storage bucket. `db:migrate` applies new database tables and functions without resetting cases. `db:seed` imports the fictional examples. `devx` checks local Supabase before starting Next.js; use `bun run dev` when Supabase is already running. Open the URL printed in the terminal and stop Next.js with Ctrl+C. Supabase continues in the background until `bun run db:stop`.

Configure the local database values described in the README. For generated answers, set `OPENAI_API_KEY` in the ignored `.env.local`. `OPENAI_CHAT_MODEL` optionally selects the chat model; otherwise chat uses `OPENAI_CASE_MODEL`, then the existing pinned `gpt-4.1-mini-2025-04-14` fallback. Restart Next.js after environment changes. Live interpretation, answer, and embedding calls are billable even with a local database.

Without an AI key, case-name matching and keyword retrieval still show original passages, with a visible warning. After adding the key, retry the latest paused turn. If generation fails after retrieval, the cases and excerpts remain saved. A provider or interpretation failure before retrieval preserves the question, but may have no results yet.

For production verification:

```bash
bun run test
bun run lint
bun run format:check
bun run typecheck
bun run build
bun run start --port 3001
```

The production server serves the generated build, so `build` must finish before `start`. With the production server running, run `TEST_BASE_URL=http://localhost:3001 bun run test:integration` in a second terminal. The integration suite uses local Supabase and mocked models for query generation; it creates and cleans up its own sessions and cases.

## What the files do

- `src/features/queries/query-entry.tsx` opens the request form or a saved query, and `query-workspace.tsx` owns interactive chat state. The homepage stays a Server Component; a small client companion supplies Wren's existing illustration and its position for the [first-query transition](wren-query-transition.md). A Suspense boundary contains the client component that reads URL search parameters. The shared workspace layout keeps recent-query navigation mounted.
- `src/features/queries/server/process-turn.ts` orchestrates interpretation, authorized retrieval, evidence collection, answer validation, and saving. `server/openai.ts` calls OpenAI only from the server with provider response storage disabled. No chat SDK was added.
- `src/features/queries/server/repository.ts` stores and restores conversations. `server/evidence.ts` adds context and caveat excerpts from Ready sources, checks evidence before generation completes, and preserves source locations.
- `src/features/queries/validation.ts` validates input and structured answers. The model selects evidence IDs; the server supplies their original text, pages, and links. Response text is rendered as React text, without interpreting generated HTML or links.
- `supabase/migrations/202610160005_conversational_queries.sql` adds session-owned conversations, ordered turns, attempt accounting, atomic turn claims, and a chat retrieval function. Existing `/api/retrieval` callers keep their previous behavior. Chat keyword candidates are independent of the semantic cutoff, and focused searches rank passages within the selected case.

The HTTP interfaces are `GET/POST /api/queries`, `GET /api/queries/[id]`, and `POST /api/queries/[id]/turns`. Creating a query sends a request UUID, request text, constraints, and optional focused case ID. Submitting a turn sends its own UUID, message, scope (`library`, `case`, or `related`), and optional case ID. The browser never supplies trusted history, citations, or the session ID; the server loads those after checking the demo-session cookie. Responses are private and uncached.

## Persistence, recovery, and limits

Conversations belong to the existing 24-hour cookie-backed demo session. Another session cannot list, reopen, or generate against them, or retrieve that session's private cases. Expiry ends access; it does not promise automatic deletion. There is no cross-device account history.

Each turn uses an idempotent request ID and one processing claim per conversation. A duplicate completed submission returns its saved answer. A live duplicate does not launch another model run. An interrupted processing lease can be resumed after five minutes. Only the latest failed turn can be retried; older questions can be asked again as new turns. Completed retrieval is reused on retry if its evidence is still current. A source change triggers fresh retrieval; older saved answers retain their original excerpts and warn when their sources changed or are no longer Ready.

`AI_CHAT_SESSION_LIMIT` defaults to 50 generation attempts per session and `AI_CHAT_DAILY_LIMIT` to 100 per UTC day across the database. These are separate from AI-reading attempts and embedding token budgets. Development disables chat attempt limits; production, including a local production server, enforces them. Zero pauses new generation attempts. A turn reserves one attempt before its model work, with at most an interpretation call and an answer call. Failed or uncertain attempts retain their reservation; an explicit retry reserves another. Each provider call has a 60-second timeout.

Input remains limited to 10,000 characters per message and 1,000 per optional constraint. Model history includes up to eight previous turns within 24,000 serialized characters, plus the original request and current question. Excluded older context produces a warning. Case-name interpretation uses the first 200 authorized catalog entries; choosing a case in the library also includes that explicitly selected case. Evidence is bounded to up to three result cases plus the reference case for related searches, nine excerpts per case, and context/caveat sampling from up to six Ready documents per case. These are selected passages, not a claim that Wren read every document in full.

## Verification and remaining limitations

Focused unit tests cover input limits, scope validation, fabricated citations, unsupported answer sections, bounded history, and provider refusals/malformed output. The query integration suite verifies persistence, isolation, duplicate and concurrent claims, case filters, related-case exclusion, recovery, and atomic usage limits. Browser verification covers the real form-to-chat journey, source inspection, restoring recent queries, responsive layouts, keyboard input, and themes.

Citation validation establishes that a reference identifies a supplied, authorized excerpt. It cannot automatically prove that every sentence follows from that excerpt. Inspect the originals and evaluate answer support manually, especially for missing outcomes, conflicting documents, and recommendations. Retrieval rankings are candidates, not calibrated confidence percentages. Incomplete indexing remains visible and can omit relevant work.

Request attachments, shared snapshots, decision graphs, full reuse-plan generation, and plan saving/export remain outside this feature. The screenshot's controls for those features are intentionally absent.
