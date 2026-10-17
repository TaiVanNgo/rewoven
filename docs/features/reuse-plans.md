# Reuse plans

Imagine a new course-registration project. Your team has a fictional registration journal describing seat leases and a duplicate-confirmation issue. Discuss the new requirements with Wren, attach the relevant case, and choose **Draft reuse plan**. Review the request, generate a draft, change the recommendations, choose **Save**, and download **Export Markdown**.

The result is a starting plan for human review. A cited requirement or design proposal does not establish delivered functionality. Missing outcomes remain unknown, and recommendations describe proposed work.

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

1. Start a Wren chat and describe the new work. Use **Add cases** to attach a relevant fictional sample, such as Summit Course Registration Engineering Journal. Library mode searches your uploads; samples need explicit selection.
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

## Editing, evidence, and export

For example, select “Evaluate transaction-enforced seat reservations” and choose **Bold**. The editor displays bold text, while Markdown mode contains `**Evaluate transaction-enforced seat reservations**`. Choose **Save**, reload, and export: the formatting and existing `[S1]` reference remain in the saved Markdown. Opening the editor, focusing it, or switching modes without editing does not change the saved text or enable Save.

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

Set `TEST_BASE_URL` when the app uses a port other than 3000. The fixture script rejects hosted Supabase targets and creates only its own fictional session records. Always run cleanup afterward, including after a failed browser check. Screenshots are written under `/tmp/rewoven-plans-browser/`.

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
