# Talk through past projects with Wren

Wren is a conversational case advisor. You can greet it, ask about a project, compare past decisions, or ask what lessons apply to your next decision. Its substantive answers and advice use case sources; it does not supply general-purpose advice from outside knowledge.

## Try a conversation

1. Open **New chat** and say “Hi Wren, what can you help me with?” A greeting needs no case search.
2. Select **Add cases**. The **My cases** tab contains your uploads. To try fictional data, explicitly choose **Sample cases**, select **Harbor Route Planning Pilot**, and apply the selection.
3. Ask “What happened during the pilot, and what limits should I keep in mind?” Wren searches the attached case’s original documents and links its answer to source passages. The fictional Harbor results cover a limited pilot; proposed expansion is not a measured company-wide outcome.
4. Follow up with “Based on those limits, what should we check before expanding?” Wren can suggest an application of recorded lessons and identify missing evidence. Suggestions are not historical facts.
5. Add another case to compare them. Up to five cases can be attached. Wren searches only those cases until you select **Use my library**, which returns to your uploaded cases. Samples never enter automatic library discovery.
6. Open a citation to inspect the original source and page. Use **Sources** to hide or reopen the evidence panel. **Recent queries** restores the chat, case selection, messages, and original evidence during the same demo session.

The case picker references existing cases; it does not upload or duplicate documents. Cases with no readable sources cannot be attached. Partially indexed sources have a coverage warning. **Create a case** opens the existing Case library flow; create and process the case there, then attach it in chat. Wren does not create records or invent historical cases for you.

**Ask Wren about this case** on a case page opens a new chat with that case attached. No answer is generated until you send a message. The first message names the saved conversation. Optional timeline, technology, and capability constraints can be supplied before sending. Enter sends; Shift + Enter inserts a line break. Unsubmitted drafts reset on reload.

## Start and verify locally

Preserve an existing `.env.local` and follow the README for local Supabase credentials. Use the Bun version recorded in `package.json`.

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:migrate
bun run db:seed
bun run devx
```

`db:migrate` adds the assistant context fields and retrieval functions without resetting cases. `db:seed` loads the fictional examples. `devx` starts the local database and development server; use `bun run dev` if Supabase is already running. Open the URL printed by Next.js. Stop Next.js with Ctrl+C, and stop the background database with `bun run db:stop` when finished.

Set `OPENAI_API_KEY` in ignored `.env.local` for chat. The optional `OPENAI_CHAT_MODEL` falls back to `OPENAI_CASE_MODEL`, then `gpt-4.1-mini-2025-04-14`. Restart Next.js after environment changes. Live model and embedding calls are billable. Without the key, keyword excerpts remain available with a paused-answer message; retry after configuring it.

```bash
bun run test
bun run lint
bun run format:check
bun run typecheck
bun run build
bun run start --port 3001
```

Build first: the production server serves the generated build rather than compiling edits. In another terminal, run `TEST_BASE_URL=http://localhost:3001 bun run test:integration`. Integration tests use local Supabase and mocked model responses, and clean up their own sessions and cases. Browser checks with a configured key exercise the actual model separately.

## How the feature works

The homepage remains a Next.js Server Component. Its Client Component chat owns typing, modal selection, and interaction. A Suspense boundary contains URL-based chat restoration. The browser sends message text and a context revision; the server loads the trusted session, conversation history, selection, and source passages itself.

- `src/features/queries/server/assistant-prompt.ts` holds the versioned, built-in Wren role and output schemas. Greetings and clarification can be uncited. Facts, interpretations, and recommendations must reference server-supplied evidence IDs.
- `src/features/queries/server/process-assistant.ts` claims a turn, reserves its generation budget, classifies intent, retrieves evidence when needed, checks for missing evidence, validates the answer, and saves it. Status reflects actual understanding, review, and answer stages. Replies appear complete after validation.
- `src/features/queries/server/assistant-retrieval.ts` searches authorized original chunks across all Ready source documents. Separate selected-case searches and an interleaved evidence budget prevent one large case from crowding out a comparison. Case overviews and previous answers do not substitute for original evidence.

Conversation creation accepts `assistant: true` and `chatContext: { mode: "library", caseIds: [] }` or selected mode with up to five case IDs. `PATCH /api/queries/[id]/context` saves a selection with `contextRevision`. `POST /api/queries/[id]/turns` submits the message, request key, and current revision. The server rejects stale selection updates and changes during an active turn. Each turn stores its own context snapshot, so retries use the original selection even after a later context change.

Migration `202610170006_wren_assistant.sql` adds conversation context, revision, per-turn snapshots, processing phases, and authorized retrieval. Existing chats and citations remain readable; legacy single-case focus becomes a selected case. The legacy query processor remains for older clients and saved-turn retries. A new message in the updated UI promotes an old chat to the assistant workflow.

## Evidence, recovery, and limits

“Full RAG” means every Ready document in the allowed cases is eligible for search. It does **not** mean every document is loaded or read on each turn. There are up to two initial search queries and one additional targeted search, across two retrieval rounds. The final evidence bundle contains at most 30 original passages or 60,000 characters. Coverage and indexing limits are visible. Ask a narrower follow-up when important details are missing.

Messages remain limited to 10,000 characters; optional constraints to 1,000 each. Recent conversational context includes up to eight earlier turns within 24,000 serialized characters, plus the original request. Older excluded history produces a warning. Case-name interpretation uses the first 200 uploaded catalog entries; the picker can explicitly select another case.

A search turn can use three model calls: intent planning, an evidence sufficiency check, and answer generation. A conversational turn uses only the planner. Planner and evidence-check timeouts are 30 seconds; the answer timeout is 60 seconds. Assistant embedding calls time out after 15 seconds and fall back to keywords. The model provider does not store responses (`store: false`).

`AI_CHAT_SESSION_LIMIT` defaults to 50 attempts per session; `AI_CHAT_DAILY_LIMIT` defaults to 100 per UTC day across the database. These are turn-attempt limits, not individual model-call counts; an explicit retry reserves another attempt. Development disables chat attempt limits, while production servers enforce them. Embedding budgets remain separate.

One live processing claim is allowed per chat. Duplicate completed submissions return the saved answer; interrupted turns can be retried after five minutes, and only the latest failed turn is retryable. Assistant retries retrieve fresh evidence using the saved selection. Already retrieved excerpts remain visible if later generation fails. Older saved answers retain original excerpts and warn when sources change.

The 24-hour cookie-backed demo session isolates uploaded cases and conversations. Expiry ends access; it does not automatically delete stored data. There is no cross-device account history.

## Verification and boundaries

Unit tests cover selection validation, bounded plans, citation validation, conversational output, and fair evidence limits. Integration tests cover greeting without retrieval, multiple selected cases, evidence in an eighth document, more than three discovered cases, uploaded-versus-sample boundaries, ownership, context revisions, concurrency, retries, persistence, and missing-key recovery. Existing ingestion and legacy query tests remain part of the suite.

Citation validation proves that an ID refers to an authorized original passage, not that every generated sentence is entailed by it. Model instruction-following and factual support still require evaluation against the originals. No complete-corpus coverage claim or calibrated confidence percentage is provided.

Direct chat uploads, case creation by Wren, web search, editable system prompts, streaming, shared conversations, and saved reuse plans remain outside this iteration.
