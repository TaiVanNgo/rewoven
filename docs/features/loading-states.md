# Understanding loading states and skeletons

A skeleton is a temporary outline of content that has not arrived yet. The library now shows a grid of case-card placeholders. Opening a dedicated case page shows a title and narrative-section outline until its session-authorized API request finishes.

The placeholders use Rewoven's existing colors and controls. No dependency, artificial delay, or fake action is added.

## Current behavior

- The nested case-library layout initializes the demo session once and keeps one document processor alive across library/detail navigation.
- Library cards load after session initialization. Search lives in `?q=`; the previous results stay visible while the next request resolves.
- A case page loads its own details. Background processing refreshes retain existing content rather than flashing back to skeletons.
- Session and API failures show an error and retry control instead of an endless skeleton. A case outside the session is not replaced with another case.
- Next.js Suspense boundaries surround runtime URL hooks and dynamic route parameters. The workspace frame can render while the selected route loads.
- AI reading and form submission retain their progress text and disabled controls. They do not replace editable forms with skeletons.

[case-skeleton.tsx](../../src/features/cases/case-skeleton.tsx) defines the card-grid and narrative placeholders. Route `loading.tsx` files and the client data views reuse them. Update these shapes alongside future layout changes.

## Inspect locally

After the [README setup](../../README.md#quick-start), run `bun run devx` and open the printed URL. Visit **Case library**, then open a case. Browser Network throttling can make the loading transitions easier to see; remove it afterward. Repeat at a narrow width and in dark mode. Reduced-motion preferences disable the shared skeleton animation.

Ctrl+C stops Next.js. Use `bun run db:stop` separately if you also want to stop local Supabase while retaining data. For production verification, run `bun run build`, then `bun run start --port 3001`.

Unit/API checks and production compilation cover the refactor's data paths. Browser verification covers the library, dedicated overview, citation panel/dialog, and narrow layouts. Cached navigation can be too fast to show a fallback naturally. Earlier split-view loading checks describe the retired UI and are not validation of the new layout; a full screen-reader audit is not claimed.
