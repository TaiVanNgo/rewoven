# Wren's query transition

Wren's search stage reuses the original `/images/wren.png` illustration. A three-second decorative loop shuffles three small documents above her folder, with teal threads, expanding search rings, and a lime highlight. These shapes do not report actual matches, filenames, confidence, or backend progress.

## Try a first request

For example, enter “Find a previous document-search project” on **New request**, then choose **Find past cases**. Wren leaves her small portrait panel, grows into the center of the visible workspace, and searches while the original page remains softly dimmed. The source portrait is hidden without collapsing its panel.

The browser starts saving the query immediately. When the chat layout opens, Wren fades away after the brief minimum gesture; she does not wait for the first answer. The chat's existing indicator continues while evidence and the answer are prepared. Follow-ups, **Find related**, retries inside chat, recent queries, and reloads keep their existing loading behavior without the large animation. A newly submitted edited request is a new conversation, so it gets the animation.

If saving fails, Wren returns to her portrait, the error appears, and the draft stays editable. If the saved query cannot open, the overlay fades away to expose the query's error and recovery link. Navigating elsewhere cancels the presentation and pending creation fetch, so a late response cannot take you back into chat. An aborted browser request cannot undo a query already saved by the server.

## How the handoff works

`src/features/queries/query-entry.tsx` stays mounted while the URL changes from `/` to `/?query=<id>`. It owns the portrait ref and mounts the overlay outside the form/chat switch. `use-wren-transition.ts` coordinates the minimum hold, exit, return, cancellation, and keyboard focus; this state is temporary and is never saved in query history.

`QueryWorkspace` exposes optional `onReady(id)` and `onLoadError(id)` callbacks. Readiness is signalled after the loaded conversation layout mounts, independently of first-answer generation. Existing callers can omit both callbacks. Query creation, turn APIs, database records, and request idempotency are unchanged.

The homepage remains a Next.js Server Component. Measuring the portrait, reacting to submission, and animating need browser APIs and state, so those parts live in small Client Components. Covered workspace controls become `inert` during the transition; a separate polite status announces the handoff. Sidebar navigation remains usable. On completion, keyboard focus moves to the chat heading; creation failures return focus to the request field. Focus is not moved away from the sidebar if the user is using it.

## Animation pieces

`src/features/requests/wren-companion.tsx` contains the existing homepage portrait and introduction. Its optional image ref lets the query controller measure the portrait before hiding it; the portrait's space stays reserved while Wren travels.

`src/features/queries/wren-search-stage.tsx` renders a temporary fixed overlay. Its `transition` prop supplies the source rectangle and a phase: `searching`, `exiting`, or `returning`. Motion handles travel and fades; scoped CSS and SVG handle the decorative loop. Nothing runs until the stage mounts. The existing Motion provider and the CSS media query respect reduced motion.

The already-loaded portrait is retained as a background preview while the larger stage image downloads, preventing a blank character during travel on slow connections.

`wren-geometry.ts` centers the stage within the visible part of the main workspace, excluding the desktop sidebar. It leaves room for a loading message, caps the image at 440px, and fits small screens. Resize, workspace-size changes, and scroll recalculate the destination. An offscreen portrait uses a centered fade rather than flying in from below the page.

Movement takes 650ms. The minimum normal-motion presentation is 1.2 seconds from submission; the exit takes 300ms. A failed creation can return to the portrait in 350ms. Reduced motion uses static art, immediate transitions, and no minimum hold.

The artwork has its original pale background. It is deliberately preserved rather than replaced with a remote image or regenerated character. The reference's card styling is adapted to the actual folder position in this artwork.

## Verify the pieces

From this worktree, install the recorded dependencies with `bun install --frozen-lockfile`. Run `bun test tests/wren-geometry.test.ts` for viewport fitting, sidebar-aware centering, offscreen origins, and presentation timing. The animation itself requires browser inspection; geometry tests do not establish visual quality or request-flow behavior.

For the real query flow, follow the README's local Supabase setup and preserve existing `.env.local` settings. Start with `bun run devx` (or `bun run dev` if Supabase is already running), open the printed URL, and submit a request. Stop Next.js with Ctrl+C. Optional AI settings affect the answer, not the transition.

Run `bun run test`, `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run build`. Then use `bun run start --port 3002` for a production browser check; `start` serves the previously generated build, so building comes first. Keep `SITE_URL` aligned with your chosen local port as described in the README.

Inspect a fast and a throttled request, a failed save, a failed query load, follow-ups, recent-query navigation, and reload. Repeat on narrow/short screens, with the sidebar collapsed, in both themes, and with reduced motion. While a slow save is pending, navigate to **Saved plans**, wait for its former response, then return: no overlay or unwanted navigation should remain.

Browser checks can use controlled API responses to make timing and failures repeatable without model calls. Those checks establish presentation behavior, not connectivity to a deployed database or live model quality.

## Verified locally

On October 17, 2026, all 65 unit tests, the query API integration test, lint, formatting, type checking, and the production build passed. Browser checks against development and production covered fast handoff before the first answer, failures and retry, retained drafts and focus, follow-ups, history/reload, mobile/dark mode, short screens, sidebar collapse, and navigation cancellation. The fast production transition took about 1.5 seconds including its fade; reduced motion added no presentation hold.

A real local Supabase request also saved and opened its chat, dismissed Wren, and displayed keyword case matches. This worktree's preview has no AI key, so generated answers and live semantic search were not verified. Deployed behavior was not checked.
