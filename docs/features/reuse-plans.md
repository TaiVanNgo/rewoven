# Reuse plans

Imagine a new branch purchasing project. Your team has a fictional purchasing pilot describing revision-bound approvals and a reimbursement project recording a duplicate-submission incident. Discuss the new requirements with Wren, attach the relevant case, and choose **Draft reuse plan**. Review the request, generate a draft, change the recommendations, choose **Save**, and download **Export Markdown**.

The result is a starting plan for human review. A cited requirement or design proposal does not establish delivered functionality. Missing outcomes remain unknown, and recommendations describe proposed work.

## Read the plan from outcome to action

New drafts are written for a project lead preparing a client discussion or engineering brief. Wren aims for 400–650 words, with room to preserve important requirements. That length is writing guidance, not a reason to cut an access rule or approval condition.

The plan uses these sections in order:

| Section                      | What to look for                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| **Proposed outcome**         | The proposed solution and an illustrative workflow based on the confirmed request.        |
| **What to reuse and change** | A few relevant historical approaches, why they help, and the adaptation needed this time. |
| **Implementation steps**     | Ordered actions, each with a **Done when** condition that someone can check.              |
| **Risks and limits**         | Material limitations, conflicts, or dependencies. Omitted when empty.                     |
| **Decisions to confirm**     | Unanswered questions and the work each answer affects. Omitted when empty.                |

For example, the older format could say:

> **Suggested action:** Reuse the immutable revision-bound approval model.

A clearer reuse item explains the behavior and the boundary:

> The purchasing pilot recorded approvals tied to the exact request version. For this request, adapt that pattern to both review stages so changes require approval again. The pilot does not establish that the combined two-stage flow works. [S1]

An implementation step then makes the action reviewable:

1. Add manager review, then finance review when the confirmed spending rule requires it.

   **Done when:** tests below, at, and above the threshold take the correct stages, and changing a price after approval restarts manager review.

The citation above is illustrative: real draft markers resolve to that draft's retrieved evidence. Wren keeps the evidence kind internally, but uses natural wording instead of prefixing every bullet with “Recorded evidence” or “Suggested action.” Numbered steps and completion conditions use ordinary Markdown, so they work in the visual editor, preview, and exported file.

Current requirements come from the reviewed request and request documents. Historical citations support claims about past work and proposed reuse. For example, Northbank's inclusive VND 10 million threshold is a client requirement; an unimplemented purchasing proposal cannot establish that the threshold was delivered successfully. Full historical excerpts remain under **Original AI draft and evidence**, and exports retain request-document references separately.

During request review, check exact amounts, stage order, who can act, which edits restart approval, retry/access rules, exclusions, and delivery constraints. Preparation is instructed to preserve them explicitly and surface unresolved conflicts. This instruction does not guarantee that a model will retain every requirement: review the summary before confirming it. A requested four-week window remains a constraint, not a verified delivery estimate.

When no suitable precedent is available, the clarification draft explains the gap, lists discovery steps with completion conditions, and asks for relevant records. It omits reuse claims rather than filling the plan with unrelated cases. Partial evidence should produce fewer reuse items, and conflicting evidence should retain both references.

Existing plans keep their original saved text and headings. To get the new structure, create a separate draft from the chat; old plans are never automatically rewritten.

## Set up and try it

Use Node.js 20.19+ and the Bun version in `package.json`. Start the Docker-compatible runtime and configure ignored `.env.local` using the README. Keep server credentials and `OPENAI_API_KEY` there, never in browser code.

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:migrate
bun run db:seed
bun run dev
```

`db:migrate` adds session-owned plan records and transactional processing/save functions without resetting existing cases. `db:seed` loads the fictional case catalog; it does not call an AI provider. Start the frontend with `bun run devx` instead of `dev` when you also need to start the local database.

Open the printed URL, usually `http://localhost:3000`:

1. Start a Wren chat and describe the new work. The default Case library includes the nine preloaded fictional Threadline Delivery projects plus your session’s uploads. Optionally use **Add cases** to narrow discovery to particular projects such as Office Purchasing Pilot.
2. Choose **Draft reuse plan** after Wren finishes answering. Request preparation uses the original constraints and at most eight recent user messages / 24,000 characters. Active request documents and their source-linked findings are captured separately from historical cases. It does not use earlier AI answers as evidence. A notice identifies omitted older context; add any important missing details.
3. Correct the title, requirements, deadline, technology, capabilities, and questions. Choose **Confirm request and generate plan**. If preparation fails or the key is absent, a manual review form remains available.
4. Read the preview and open numbered citations. Their source list retains the original excerpts, document versions, and locations. The request describes proposed work and remains separate from historical evidence.
5. Edit the title and plan. **Visual** opens a formatted editor with a toolbar; select text before choosing bold, italic, strikethrough, or **Edit link**. Choose paragraph/headings, bullet/numbered lists, blockquotes, code, or a divider to structure the plan. **Markdown** opens its source. On mobile, switch between **Edit plan** and **Preview**. Keep stable markers such as `[S1]` next to supported claims. Separate consecutive markers with a comma: `[S1], [S2]`. Rewoven manages their reference definitions separately.
6. Choose **Save**. Generation stores a recovery draft automatically, but it does not add a plan to Saved plans until you explicitly save it. Saved plans survive refresh within the same 24-hour demo session.
7. Choose **Export Markdown**. This downloads the latest saved version, including the confirmed request, plan, warnings, historical source excerpts, request-document references, and absolute source links. Save pending edits first.

Stop Next.js with Ctrl+C. Supabase keeps running; stop it with `bun run db:stop` to preserve local data. For production testing, run `bun run build` before `bun run start`: the production server requires the compiled application. Production deployment uses the existing Vercel migration workflow; Preview builds do not apply hosted migrations.

## What the files do

- `src/features/plans/` contains request/plan types, content validation, Markdown serialization, editor, preview, saved list, and chat action. Its `server/` modules handle ownership, database operations, model calls, and retryable stages.
- `src/app/api/plans/` contains read, save, generation, and download endpoints. `src/app/api/queries/[id]/plans/route.ts` starts preparation from an existing chat.
- `supabase/migrations/202610170008_reuse_plans.sql` adds plan records, AI-attempt reservations, processing leases, and revision-checked saves.

Next.js maps folders under `app` to URLs: `/saved-plans` lists saved plans, and `/saved-plans/[id]` opens an individual draft. Pages remain Server Components; the editor and preview are Client Components because typing, browser recovery, and citation dialogs need interactivity. Credentials, model calls, and database writes remain server-side.

The server captures the originating chat and case-selection scope. Confirmation freezes the reviewed request. Generation searches original source passages afresh with the existing evidence budget of 30 passages / 60,000 characters. Attached documents' opening paragraphs are not automatically added to establish precedent. The model returns typed findings and server-resolved evidence IDs; validation runs before Markdown is published.

Each generation creates a separate draft. Retries resume that draft and confirmed request. To change the confirmed request, return to the chat and create another plan. The original generation stays separate from the latest explicit save; there is no full save history or automatic merging.

The generated JSON now carries `formatVersion: 2`, five ordered sections, and a `doneWhen` string for every item. Only implementation steps use a nonempty `doneWhen`; validation requires an observable-condition field for every step. Required sections cannot be empty in a reuse draft, and every reuse choice must reference historical evidence. Risks and decisions may have empty arrays and are omitted from Markdown. The schema keeps the existing fact/inference/recommendation/unknown kinds. Structural validation cannot determine whether a completion condition is useful or whether a passage entails a claim.

The `generated` field supports legacy unversioned records alongside version 2. Existing generated and saved Markdown remain authoritative for those records; reading, editing, saving, and exporting them does not regenerate their content. No database migration, new endpoint, model change, or additional model call is required.

## Editing, evidence, and export

For example, select “Evaluate revision-bound purchase approvals” and choose **Bold**. The editor displays bold text, while Markdown mode contains `**Evaluate revision-bound purchase approvals**`. Choose **Save**, reload, and export: the formatting and existing `[S1]` reference remain in the saved Markdown. Opening the editor, focusing it, or switching modes without editing does not change the saved text or enable Save.

The toolbar offers paragraph/headings 1–3, bold, italic, strikethrough, bullet/numbered lists, blockquote, inline/fenced code, horizontal rule, link editing/removal, and undo/redo. Focus a toolbar button and press Enter to use it with the keyboard. To add a link, select ordinary text, choose **Edit link**, and enter an `http://`, `https://`, `mailto:`, or local URL such as `/case-library`. Open the link dialog again to change or remove it. Open evidence through the preview's numbered references. Citation chips in the editor preserve their source numbers; changing surrounding text does not verify its claims.

Markdown remains the saved format; this editor update requires no new migration or API changes. `formatted-plan-editor.tsx` selects the editing mode, `visual-plan-editor.tsx` owns TipTap, selection formatting, and the link dialog, and `editor-markdown.ts` defines the supported formatting and citation conversion. The parent `plan-editor.tsx` keeps the existing save, recovery, preview, and conflict handling. The editor loads only when a ready plan needs it; browser-only initialization avoids a server/client hydration mismatch.

TipTap's Markdown bridge is [currently beta](https://tiptap.dev/docs/editor/markdown). Before visual conversion, Rewoven checks for unsupported features and whether conversion preserves the document. Plans with tables, task lists, raw HTML, images, reference definitions, headings 4–6, unsupported links, or formatting that cannot round-trip safely open in Markdown mode with an explanation. Their source remains intact. You can keep editing and saving supported Markdown in source mode without converting it. Tables have no visual editing controls in this version. Fonts, colors, alignment, images, and collaboration are outside this toolbar's scope.

Clipboard input uses text rather than foreign HTML. Supported pasted Markdown is converted to the editor's formatting; unsupported pasted syntax is inserted as a code block with a notice so its text stays literal. Paste into Markdown mode when you want to retain unsupported formatting as source. Move citation markers outside a paragraph before converting that paragraph into a code block; the toolbar and keyboard shortcut guard this conversion because code blocks only support text. The original preview safety rules still apply. Undo/redo covers visual changes since the visual editor was opened; switching to source and back starts a new visual undo history. Actual visual edits may normalize Markdown spacing and delimiters. The 50,000-character limit applies to the serialized Markdown: an oversized visual edit remains available to shorten, but cannot be saved.

Markdown preview supports headings, lists, tables, task lists, and code. Raw HTML is omitted, unsafe URL protocols are filtered, and remote images are not rendered. Citation markers resolve through an immutable server-owned evidence map and open the existing source viewer.

Unknown citation markers and redefinitions block saving. Removing original markers shows a warning. Edited content is labelled as user-edited and is not automatically checked for whether a passage still supports a revised claim. Valid IDs prevent broken references; they do not prove factual support. Inspect the original AI draft and evidence when reviewing substantial changes.

Explicit saves use a revision number. A stale save from another tab is rejected, leaving local edits intact. Open the latest saved plan in another tab to compare. Unsaved ready-plan edits have a tab-local `sessionStorage` recovery buffer, and in-app navigation/reload warnings protect against accidental loss. Browser Back/Forward does not have a universal blocking prompt; the recovery buffer is the fallback. The buffer is not a server save or a cross-device backup. Unconfirmed review-form edits remain local until confirmation.

Exports contain the saved title and Markdown, confirmed request/constraints, coverage warnings, and referenced source excerpts. Private source links require the same active session, while exported excerpts remain readable independently. Export deliberately includes fictional or user-provided source content; review it before distributing the file. No AI call is needed to read, edit, save, or export an existing ready plan.

Session expiry ends access to saved plans and sources. It does not automatically delete stored records or files. Individual plans are excluded from the sitemap and marked noindex; session authorization protects their data.

## Recovery and usage limits

- Missing/failed preparation preserves a manual request-review form.
- A retrieval/database error or provider failure preserves the confirmed request and permits retry. It is not reported as a legitimate no-match result.
- If no suitable evidence is found, a **Clarification draft — no suitable precedent found** identifies gaps, questions, and discovery steps without claiming reusable historical work. With zero passages this is constructed without a generation-model call.
- Source changes during generation reject the output. Retry to retrieve current evidence. Later source changes retain saved excerpts and display a warning.
- Interrupted processing can be retried after the five-minute processing lease expires. An in-flight server request may finish even after the page closes. Reopen the draft to check its status.
- Double-clicks and repeated operation identifiers do not duplicate completed model work. Failed or uncertain calls retain budget reservations; a new processing attempt counts again.

### Recover from “The plan has missing sections”

This message comes from the generated-plan validator, not from missing case files. For example, the old provider contract allowed three proposed-outcome items even though the editor's plan format allowed only two. It also allowed repeated or reordered headings. A response could satisfy the provider's JSON schema and still fail the application's checks.

The generation contract now requires five named section arrays, with section-specific item limits, completion conditions, and historical citation rules. Separate reuse and clarification shapes keep unsupported reuse claims out of clarification drafts. `src/features/plans/model.ts` defines that contract; `content.ts` converts the named sections into the existing ordered format, checks the content, and creates Markdown. Saved plans and exports keep their existing format, and this fix needs no database migration.

The contract uses required object properties and nested alternatives supported by [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). The application still validates the returned content and citations before publishing a draft.

For an existing failed draft, keep its confirmed request and choose **Retry generation** after the updated app is running. A successful retry replaces the failure with an editable AI draft; it does not explicitly save your plan. Choose **Save** when you have reviewed it. Provider timeouts, insufficient evidence, and unsupported citations still have their own checks. The structural fix does not establish that every generated recommendation follows from its sources.

Plan stages use the configured chat model (`OPENAI_CHAT_MODEL`, then `OPENAI_CASE_MODEL`, then the existing default). Optional server-only settings:

```dotenv
AI_PLAN_SESSION_LIMIT=50
AI_PLAN_DAILY_LIMIT=100
```

Preparation and generation reserve separate attempts. The daily limit is shared across the database and resets at midnight UTC. Zero disables new model stages; development disables attempt limits. Embeddings continue to use their existing separate token budgets. These counters bound attempts rather than guaranteeing a particular monetary spend. Restart Next.js after changing configuration.

## Verification

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
# With local Supabase and the application running:
bun run test:integration
```

Unit tests cover structured findings, invalid references/redefinitions, and export content. The plan integration test uses mocked model/retrieval dependencies with real local database/API persistence to check selection snapshots, explicit saves, source versions, retry, duplicate/concurrent generation, attempt limits, stale-save protection, download, and session isolation. CI includes it without making paid provider calls.

Browser checks use fictional local records and mocked generation, with real save/read/export/source endpoints. They cover request review, Markdown preview safety, citations, refresh, unsaved recovery, save conflicts, downloads, and mobile layout. These checks do not establish live-model relevance, organizational value, or hosted-deployment behavior. A production database needs the new migration before this feature can work; merging through the existing production release workflow applies it.

Editor unit tests also cover formatting round trips, exact citation serialization, escaped brackets, code, unsupported-source detection, and link policy. Browser checks exercise the toolbar, link dialog, undo/redo, unchanged mode switching, serialized length limit, formatted saves/exports, and light/dark mobile layouts.

For the optional browser regression, use a Python environment with Playwright installed and Google Chrome available (or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to your Chromium executable). With local Supabase and the app already running:

```bash
bun --env-file=.env.local tests/plans.browser-fixture.ts
python3 tests/plans.browser.py
bun --env-file=.env.local tests/plans.browser-fixture.ts --cleanup
```

Set `PLAN_BROWSER_START_FAILED=true` on the fixture-creation command to start with the missing-sections failure and exercise **Retry generation** through to editing, saving, reloading, citations, and export. The browser test mocks the provider response; `tests/plans.integration.ts` separately checks the actual processing and retry logic with named-section model fixtures.

The section-contract fix was verified locally on 19 October 2026: 156 unit tests, the plan lifecycle integration test, failed-draft browser recovery, lint, types, formatting, and a production build passed. Retrying the reported local failed draft through the actual model and processing pipeline produced a valid five-section draft while preserving its confirmed request and explicit-save state. This checks structural recovery, not sentence-level source support or hosted deployment.

Set `TEST_BASE_URL` when the app uses a port other than 3000. The fixture script rejects hosted Supabase targets and creates only its own fictional session records. Always run cleanup afterward, including after a failed browser check. Screenshots are written under `/tmp/rewoven-plans-browser/`.

### Opt-in writing-quality review

The version 2 update was locally verified on 19 October 2026: 145 unit tests, 21 integration tests across 14 files, formatting, lint, type checking, and the production build passed. Browser checks at 1440 px and 390 px in light/dark themes covered the new headings and numbered completion conditions, citations, editing, save/reload, export, recovery, conflicts, and legacy-plan display/export. Provider output was mocked. The live evaluation below was not run; its explicit opt-in guard was checked without making a provider call.

To inspect an actual model response separately from mocked tests:

```bash
bun --conditions=react-server --env-file=.env.local scripts/evaluate-plans.ts --live
```

This makes **one billable OpenAI plan-generation call**, using the configured chat model and `OPENAI_API_KEY`. Without `--live` it exits before making a provider call. It supplies the local fictional Northbank constraints and selected historical implementation notes, validates the versioned structure, and writes `plan.md` and `plan.json` into a new `/tmp/rewoven-plan-quality-*` directory. The sample includes original source excerpts for manual comparison, without app citation-viewer links. No database records are changed, and this standalone script does not apply the app's usage counters.

Review the sample against these questions:

- Can a project lead identify the outcome, first action, reused approach, and main unanswered decision without interpreting unexplained jargon?
- Does each step have an observable completion condition, with dependencies in a sensible order and no repeated questions?
- Are the inclusive VND 10 million threshold, review order, distinct actors, approval invalidation, retries, branch permissions, scoped event export, and exclusions preserved?
- Are proposals distinguished from delivered behavior, and is four weeks still a requested constraint?
- Do the cited excerpts support the historical claims, including any conflicting evidence?

This is a fixed-evidence writing review, not a retrieval benchmark, a request-preparation test, or a production-quality certification. Word count is reported for review; it does not automatically pass or fail quality. Mocked fixtures verify structure, source-marker preservation, persistence, and export, but cannot establish how consistently a live model writes clear or complete plans. Broader live evaluation remains separate.

### Developing in a separate worktree

Run these commands from the editor worktree, after configuring its own ignored `.env.local` for local Supabase and setting `SITE_URL=http://localhost:3002`:

```bash
bun install --frozen-lockfile
bun run dev --port 3002
```

Open `http://localhost:3002`, then **Saved plans**. A worktree gives the code and Next.js build files their own directory. It still shares local Supabase when both checkouts use the same local URL, so do not reset or stop the database used by another checkout. Stop this Next.js server with Ctrl+C.

For browser verification from a second terminal in that worktree, use a separate fixture file and preserve the same variables for setup, checks, and cleanup:

```bash
export TEST_BASE_URL=http://localhost:3002
export PLAN_BROWSER_FIXTURE=/tmp/rewoven-editor-browser-fixture.json
bun --env-file=.env.local tests/plans.browser-fixture.ts
python3 tests/plans.browser.py
bun --env-file=.env.local tests/plans.browser-fixture.ts --cleanup
```

Use the Python executable from an environment with Playwright installed. The optional `PLAN_BROWSER_FIXTURE` setting keeps simultaneous browser runs from sharing their session fixture file.

Editor-update verification on 17 October 2026 passed 116 unit tests, all 14 API/database integration tests against the worktree’s local server on port 3002, formatting, lint, type checking, and a production build. Browser checks passed at 1440 px and 390 px in light/dark themes, including every toolbar action, keyboard formatting, typed citations, safe paste, citation-preserving code-block guards, unsupported-source save/reload, clean mode switching, length validation, evidence inspection, export, recovery, concurrent-save conflict, and leaving the chat during preparation. Provider stages were mocked; no paid model-quality evaluation or hosted production migration was performed.
