# Use your own OpenAI API key

Rewoven’s shared demo credit is limited. A judge or visitor can use their own OpenAI API credit for chat, request-document reading, case reading, reuse plans, and embeddings for indexing and semantic search.

## Try it

1. Open **Use your own API key** in the sidebar. It is also available on mobile and as a key icon when the desktop sidebar is collapsed.
2. Paste your OpenAI secret API key and choose **Use my key**. The input is masked. This checks its format without spending credit; OpenAI checks access when you next use an AI feature.
3. Ask Wren a question, read a document, or generate a plan. The sidebar says **Your API key is active** while your key is selected.
4. Open the same control to replace your key or choose **Remove my key**. Removing it returns future requests to the shared demo key. Reloading or closing the page clears the personal key too.

For example, a judge can add their own key, upload Northbank’s request in chat, and ask which historical projects are relevant. Request-file reading, chat planning and answering, and query embeddings all use that judge’s key. If they then draft a reuse plan, its preparation and generation use the same key.

OpenAI bills the key owner’s API account. ChatGPT subscriptions do not include API credit. The key needs access to the server-configured chat/case model (currently defaulting to `gpt-4.1-mini-2025-04-14`) and `text-embedding-3-small`. Rewoven’s existing session/day attempt limits and embedding budgets still apply, including to personal-key requests. This feature does not raise those limits or enforce an exact dollar cap on the shared key.

## Where the key goes

The key stays in JavaScript memory in the open page. It survives normal client-side navigation, but is never written to localStorage, sessionStorage, cookies, database records, chat content, or plan exports. The settings form clears its input after saving or dismissing it. Each tab starts independently.

For an AI action, the browser sends the key in a dedicated header to an explicit list of Rewoven POST endpoints. Those requests reject redirects. File uploads directly to Supabase Storage, original-file downloads, and ordinary list/save/export requests do not carry it. Rewoven’s server uses the credential in its outbound authorization header to OpenAI. All deployment traffic must use HTTPS. Browser memory is accessible to JavaScript running in the page; this is temporary credential handling, not a secret vault. Operators must keep credential headers out of any future request logging or tracing.

The server isolates each request using Node’s `AsyncLocalStorage`, which keeps overlapping visitors’ keys separate across asynchronous work. No personal key is written into `process.env` or a shared provider client. Requests without a personal key use the server’s `OPENAI_API_KEY`; command-line backfills also continue to use their environment key. Missing, malformed, rejected, or exhausted personal credentials never trigger a retry with the shared key. Semantic retrieval can still fall back to keyword search when embeddings are unavailable, as before. Provider calls remain on the server, following [OpenAI’s authentication guidance](https://developers.openai.com/api/reference/overview#authentication).

Removing a key does not cancel an AI request already sent. Reloading during a staged upload/reading clears the key, so add it again before resuming. Completed readings, saved chats/plans, and existing embeddings can be reused without making another provider call. There is no stored-key account setting or automatic key verification call.

## Important files and data flow

- `src/features/ai-key/api-key-settings.tsx` is the interactive Client Component. Its dialog handles masked entry, status, replacement, and removal.
- `src/features/ai-key/client.ts` holds the temporary key and attaches it only to supported AI requests. `src/features/cases/api-client.ts` is the shared browser request helper used by the existing features.
- `src/features/ai-key/validation.ts` bounds the accepted key format and defines the endpoint allowlist.
- `src/features/ai-key/server.ts` wraps AI Route Handlers and resolves the request’s key before the existing case, chat, plan, and embedding code calls OpenAI. Next.js maps each `src/app/api/.../route.ts` file to its corresponding URL. The browser-facing component never calls OpenAI directly.
- `tests/ai-key.test.ts` covers request isolation, route coverage, safe header destinations, validation, removal, provider authorization, and failure without shared-key fallback using fake credentials and transports.
- `tests/ai-key.integration.ts` checks embedding credentials with real local database reservations and a fake provider, plus rejection at the running API. `tests/ai-key.browser.js` checks the complete settings UI and browser request headers with fake credentials and a mocked chat.

## Development and verification

Install dependencies with `bun install --frozen-lockfile`. Use the README’s local Supabase configuration in `.env.local`, then run `bun run devx` to start Supabase and development, or `bun run dev` when Supabase is already running. Open the printed local URL. Stop Next.js with **Ctrl+C**; run `bun run db:stop` to stop local Supabase separately. A personal key works even if `OPENAI_API_KEY` is unset; Supabase configuration is still required for saved sessions and feature data.

Run `bun run test`, `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run build`. To check the production server locally, run `bun run start` after the build: the server needs its generated production output and enforces production usage limits. No migration or new environment setting is needed for this feature. Provider mocks test key selection without spending OpenAI credit; a real paid-key call and the deployed production behavior require separate verification.

Local verification passed: 138 unit tests, 21 integration tests with `bun run test:integration`, lint, formatting, type checking, and the production build. The browser walkthrough passed at 390, 768, 1024, and 1440 pixels in both themes, including key replacement/removal, navigation, independent tabs, reload clearing, keyboard dismissal, collapsed navigation, and reduced motion. With Playwright CLI open on the local app, run `playwright-cli run-code --filename tests/ai-key.browser.js` to repeat it. Expected provider failures are mocked; no test spends live OpenAI credit.
