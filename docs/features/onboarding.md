# Meet Threadline Delivery: the onboarding walkthrough

Imagine you’re judging the demo. Threadline Delivery has nine past projects, and Northbank Services has a new purchasing request. You need to understand what Rewoven does before choosing where to begin. The five-step welcome introduces the company, its archive, Wren’s evidence, the new request, and the reuse-plan workflow.

All company names, clients, and project outcomes are fictional. The [purchasing demo guide](purchasing-demo.md) explains the source documents and presentation story in more detail.

## Try the flow

Use the Node.js and Bun versions and local environment setup in the [README](../../README.md). For an unchanged dependency set:

```bash
bun install --frozen-lockfile
bun run dev
```

Open the printed URL, normally `http://localhost:3000`. The first homepage visit in a browser opens `/onboarding`. The welcome renders without Supabase or an OpenAI key. Start configured local Supabase with `bun run devx` instead when you want to use the case library and saved chats. Stop Next.js with Ctrl+C; `bun run db:stop` separately stops local Supabase without deleting its data.

1. Read **Meet Threadline Delivery**. Rewoven helps the team find previous experience, inspect its sources, and decide what to adapt.
2. Choose **Next** to see all nine prepared projects. Notice that delivered work, a failed pilot, and a proposal provide different kinds of evidence.
3. Learn how to ask Wren and open a numbered citation. The conversation shown here is an illustration, not a generated answer or interactive source viewer.
4. Meet Northbank. In the actual chat, choose **Upload files**, select your supplied `client-brief.pdf` and `constraints.md`, and Send your question. You can also type your own request. Historical projects belong in Case library instead.
5. Learn **Draft reuse plan → review → generate → edit → Save → Export Markdown**. Choose **Ask about past projects** or **Bring a new request** to open an editable prompt. Nothing is sent automatically. The request path also reminds you to attach the client files.

**Back** revisits the previous step; the step navigation jumps directly to any step. **Skip** and **Return to workspace** return to your most recent workspace location during client navigation. **How to use Rewoven** in the sidebar or mobile navigation always reopens the introduction at step one. Its icon remains available when the sidebar is collapsed.

## What the files do

- [`src/app/onboarding/page.tsx`](../../src/app/onboarding/page.tsx) creates `/onboarding` through Next.js file-based routing. It is outside the workspace route group, so the welcome has its own full-page frame and metadata.
- [`story-steps.tsx`](../../src/features/onboarding/story-steps.tsx) holds the explanatory content. The server passes this content to [`onboarding-flow.tsx`](../../src/features/onboarding/onboarding-flow.tsx), the Client Component that handles step buttons, heading focus, and finishing. Static story content does not need browser state.
- [`onboarding-provider.tsx`](../../src/features/onboarding/onboarding-provider.tsx) remembers dismissal and the workspace return location. [`workspace-entry.tsx`](../../src/features/onboarding/workspace-entry.tsx) checks whether a homepage visitor needs the welcome and keeps the workspace hidden until the browser preference is known. It retains the route content in the rendered tree for Next.js instant-navigation validation. The existing root theme and Motion providers also apply here.
- [`model.ts`](../../src/features/onboarding/model.ts) defines the five step names, two allowed starter values, storage helpers, and entry rules. [`query-entry.tsx`](../../src/features/queries/query-entry.tsx) reads the starter, and [`query-workspace.tsx`](../../src/features/queries/query-workspace.tsx) applies it once to an empty composer and removes it from the URL.
- [`request-draft.tsx`](../../src/features/requests/request-draft.tsx) now lives under the root layout. It preserves new-request and saved-chat follow-up text during onboarding navigation. The text remains in memory, so reloading still clears unsubmitted drafts.

Pages remain Server Components by default. Buttons, browser storage, focus, and URL handoff need Client Components. The workspace entry uses a Suspense boundary around URL-dependent client behavior, following the installed Next.js documentation. No caching or runtime setting changes are required.

## Animations between steps

Choose Next: the next story fades in while moving 16px from the right. Back brings the previous story in from the left. The active navigation highlight moves to the selected step and the lime progress bar fills to match. Buttons give a small press response. The step and progress transitions take 280ms and use the app’s shared easing.

These interactions use the existing `motion` dependency in `onboarding-flow.tsx`. A scoped `LayoutGroup` connects the active-step backgrounds; the story has a new React key for each step. Only the incoming story remains mounted, so there are no duplicate headings or old controls during transitions. The heading receives focus immediately, and rapid step selection can replace an animation without waiting for an outgoing screen. Initial content stays visible without an entrance animation, including before hydration.

The shared Motion provider honors system reduced motion. The onboarding also subscribes to the browser’s `prefers-reduced-motion` media query with React’s `useSyncExternalStore` to remove slide, fade, highlight movement, progress tweening, and press scaling. This subscription handles setting changes while the guide is already open; the installed Motion hook only reads the preference at mount. With reduced motion enabled, navigation still updates the story and progress immediately. This follows [Motion’s accessibility guidance](https://motion.dev/docs/react-accessibility).

The browser walkthrough samples actual rendered frames for both slide directions, progress fill, and highlight movement. It also switches reduced motion while the page is open, interrupts transitions with rapid selections, and verifies that the latest story has the only heading and retains keyboard focus. Screenshots wait for the animations to finish. These checks pass in local development and the compiled production app; no AI request is needed.

## Browser preference and demo sessions

The onboarding preference is `rewoven-onboarding-v1=dismissed` in local storage. Finishing or skipping stores it; completing it in one tab also updates other open tabs. Closing and reopening the same browser preserves the preference until browser data is cleared. Opening another browser or private browsing profile normally starts with its own preference.

Storage is optional. If access throws or writes fail, dismissal remains in memory for the current page lifetime and the user can enter the workspace. A full reload can show onboarding again when persistence is blocked. The guide never needs database access to finish.

This preference is separate from the existing HTTP-only `rewoven-session` cookie. The server still uses an opaque random token with 24-hour access. Judges on separate browsers or devices have separate sessions even when sharing an IP address. Tabs in the same profile share a session. No IP address is collected for onboarding or session identification by this feature. Expiry ends access but does not automatically delete stored records or originals.

Direct chat (`/?query=…`), selected-case (`/?case=…`), case-page, and saved-plan links bypass automatic onboarding. Existing query/case links take precedence over starter parameters. Only `history` and `request` are accepted starter values; unknown values are ignored. A starter never overwrites nonempty request text or sends a chat. The automatic welcome also yields to an existing request draft or constraints.

Replay preserves text drafts and saved server data. Unsubmitted file selections remain local to the chat component: attach files after the guide. Directly opening or reloading `/onboarding` starts at step one and has no prior workspace return location, so Skip returns to `/`.

## Verify the result

```bash
bun run test
bun run lint
bun run format:check
bun run typecheck
bun run build
bun run start --port 3001
```

Build before starting the production server: `start` serves the compiled application and does not compile it. Stop it with Ctrl+C. A production server on port 3001 can run alongside a development server on port 3000.

For the repeatable browser walkthrough, start the app with configured local Supabase, then run:

```bash
bunx @playwright/cli --session onboarding open http://localhost:3000
bunx @playwright/cli --session onboarding run-code --filename tests/onboarding.browser.js
bunx @playwright/cli --session onboarding close
```

Use the port printed by Next.js. The browser check exercises first visit, all steps, heading focus, Skip, completion, replay, starter prompts, text preservation, direct links, blocked storage, and session cookies. It checks each step at desktop, tablet, and narrow mobile widths in light/dark system themes with reduced motion. It saves screenshots under ignored `output/playwright/`. It creates separate anonymous demo sessions but never submits a chat, processes files, or calls an AI model.

Unit tests cover the entry policy, fixed starter allowlist, preference persistence, and storage failures. Browser checks establish UI behavior and cookie isolation; they do not verify live AI answer quality, hosted seeding, production deployment, or search-engine indexing. The existing session/database ownership checks continue to enforce access to private cases, chats, and plans.

Verified locally for this feature: 132 unit tests, the two existing query/assistant integration tests, lint, formatting, type checking, and the production build passed. The browser walkthrough passed against both development and the compiled production app, including 40 step/width/theme combinations, keyboard navigation, text draft recovery during replay, and actual session cookies across browser contexts. The onboarding HTML, robots, sitemap, and social image returned successfully; the local configuration emits `noindex, nofollow` with no configured canonical origin. Hosted behavior remains unverified.
