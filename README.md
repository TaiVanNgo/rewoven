# Rewoven

Rewoven helps delivery teams find relevant past projects, understand what changes this time, and build a reuse plan with sources they can check.

The project uses Next.js, TypeScript, Tailwind CSS, Motion, Supabase, and Bun. The case library supports multi-document text/Markdown/PDF ingestion, source-linked overviews, dedicated case pages, and hybrid keyword/semantic retrieval. Wren is a conversational case advisor: ask questions, compare projects, and discuss decisions using original case evidence.

The homepage at `/` opens **New chat**, with a message composer, **Upload files**, optional project constraints, and **Add cases**. Upload up to five PDF/TXT/MD problem documents per message, type a query, or combine both. Wren reads files on Send and compares their requirements with historical evidence; follow-up messages retain active documents. Wren can greet users and clarify questions without searching; substantive answers and recommendations use retrieved case sources with clickable citations. By default, Wren searches the full Case library: the nine preloaded fictional Threadline Delivery projects plus historical cases uploaded in the current session. No demo-library switch is required. **Add cases** optionally narrows a chat to up to five particular projects; **Search full library** restores collection-wide discovery. Full replies appear after validation, with actual processing stages while Wren works.

**Case library** at `/case-library` provides uploads, nine read-only fictional samples, and dedicated case pages at `/case-library/[id]`. **Ask Wren about this case** opens chat with that case attached. **Create a case** in chat links to the existing library workflow; Wren does not create historical cases. Problem documents uploaded in chat remain separate from the case library. **Draft reuse plan** prepares a reviewable request from a saved chat, then generates a cited draft. Users edit Markdown, explicitly save it, and export it. **Saved plans** at `/saved-plans` lists plans saved during the current demo session. See the [reuse-plan guide](docs/features/reuse-plans.md) for the workflow, recovery, export, and limits.

**Recent queries** restores saved chats, case selections, and evidence during the same 24-hour demo session. Messages are limited to 10,000 characters. Unsubmitted chat drafts remain local and reset on reload. Ready-plan edits have a tab-local recovery buffer until explicitly saved. Submitted text, request-document passages, and retrieved historical excerpts are sent to OpenAI when configured. Missing AI configuration preserves keyword excerpts with a visible paused-answer message. Every Ready document is eligible for retrieval, but answers use a bounded selection of passages rather than reading every document on every turn.

To inspect the interface without Supabase, run `bun install --frozen-lockfile`, then `bun run dev` and open the printed URL. Saving chats and selecting cases require the local database setup below. Stop the server with Ctrl+C.

Start with the [purchasing demo guide](docs/features/purchasing-demo.md) for the nine-project story, downloadable 29-file pack, judge walkthrough, seed replacement, and evidence checks.

Read the [query file upload guide](docs/features/query-file-uploads.md) for formats, limits, staged reading, recovery, citations, and plan exports.

Read the [Wren conversational assistant guide](docs/features/conversational-queries.md) for examples, the case picker, retrieval, system prompt, persistence, limits, and recovery.

Citations use numbered markers: hover or keyboard-focus for source details, then open a modal at the cited PDF page or highlighted extracted text. The PDF renderer loads on demand. Development and builds prepare matching PDF.js assets locally. See the [citation walkthrough](docs/features/conversational-queries.md#inspect-an-inline-citation) for controls, source-version checks, and limitations.

Read the [case overview guide](docs/features/case-overviews.md) for the dedicated case page, structured AI review, manual corrections, and safe sample replacement.

Read the [case library and ingestion guide](docs/features/case-library-and-ingestion.md) for a concrete walkthrough, the browser/server/database flow, important files, and verified behavior. Added cases and submitted conversations persist in a cookie-backed demo session for 24 hours; unsubmitted drafts still reset on reload. Session expiry ends access but does not automatically delete stored records or files.

Use the [AI-assisted case reading guide](docs/features/ai-assisted-case-reading.md) to configure OpenAI, review suggested fields with evidence, and understand billing limits. AI reading is optional; manual case entry still works without an AI key.

Read the [multi-document ingestion and semantic retrieval guide](docs/features/semantic-retrieval.md) for upload quotas, resumable processing, source citations, and token budgets. After applying migrations, use `bun run db:backfill` to repair missing original sizes. To index existing Ready sources and fictional samples, run `bun run db:backfill --embed`; this makes billable OpenAI calls and preserves existing chunks. Use `bun run test:retrieval:live` for the separate billable evaluation of nine labelled requests and two no-match requests against local samples.

For loading behavior, see the [skeleton and loading-state guide](docs/features/loading-states.md). It explains route fallbacks, case-library placeholders, background refreshes, and how to inspect them on a slow connection.

Wren animates from her portrait into the workspace on the first message of a new chat, then fades as the saved chat opens. Answer generation continues independently. See the [Wren transition guide](docs/features/wren-query-transition.md) for timing, cancellation, and reduced motion.

For pull-request checks and production releases, follow the [CI/CD and production deployment guide](docs/features/ci-cd-and-production.md). GitHub Actions runs checks against disposable local Supabase and needs no production credentials. Vercel deploys `main` using `bun run build:vercel`: build the app, apply pending production migrations and storage configuration, then publish. Preview and local builds skip hosted migrations. To import the nine fictional project samples into production, temporarily set `SEED_SAMPLE_CASES=true` in Vercel Production and redeploy; see the deployment guide for permissions troubleshooting and the complete steps. Configure `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, and `SUPABASE_DB_PASSWORD` only in Vercel's Production environment, alongside the existing application settings. `vercel.json` enables normal Git deployments and requests sequential Git builds without cancelling an in-flight build.

## Quick start

Install Node.js 20.19 or newer (required by the Tailwind Prettier plugin) and the Bun version specified in `package.json` (`packageManager`). Bun manages dependencies and scripts; Next.js runs on Node.js.

For the local database and file storage, also install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (verified with version 2.120.0) and a Docker-compatible runtime. On macOS, OrbStack works; Docker Desktop is another option. Start your container runtime before running the database commands. The Supabase CLI must be available as `supabase` on your PATH.

On macOS, install the CLI with `brew install supabase/tap/supabase`, or update an existing installation with `brew upgrade supabase`.

From the project root:

```bash
bun install --frozen-lockfile
cp .env.example .env.local # First setup only; preserve an existing .env.local.
bun run db:start
bun run db:status
```

For local development, set `SITE_URL=http://localhost:3000` and keep `SITE_INDEXABLE=false` in `.env.local`. If you change the server port, update the local origin to match. Next.js loads this file automatically; it is ignored by Git.

`--frozen-lockfile` uses the dependency versions recorded in `bun.lock` without changing it and fails if `package.json` and the lockfile disagree. Use it after cloning or in CI to reproduce the shared dependency set. When intentionally changing dependencies, use `bun add <package>` or normal `bun install`, then review and commit both `package.json` and `bun.lock`. See [Bun's installation documentation](https://bun.sh/docs/pm/cli/install).

Copy the local Project URL and Secret key printed by `db:status` into your existing `.env.local`:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=replace-with-your-local-secret-key
```

Older CLI versions may label the server key `service_role`. Port 54321 serves the HTTP API; the PostgreSQL connection URL on port 54322 is for direct database clients, not `SUPABASE_URL`. Keep local credentials in `.env.local`; configure hosted credentials separately in your deployment service.

`db:start` starts Supabase and creates or updates the private `case-sources` and `query-files` buckets with a 5 MB per-file upload limit from `supabase/config.toml`. You do not need to create the bucket in Studio manually. This command explicitly targets local storage, and can be rerun after a normal stop. The first startup downloads the container images and can take several minutes. Local migrations run during initial database creation; an ordinary restart preserves the existing database. Case fixtures and their original files are imported with the separate seed command below.

After configuring the local credentials, apply pending migrations and import the nine fictional project samples:

```bash
bun run db:migrate
bun run db:seed
```

These commands preserve user cases and activate the nine prepared samples together. Retired sample records and originals remain accessible through old links; rerunning seeding preserves source and chunk identities and makes no AI calls. Run `db:migrate` after pulling schema changes. `db:start` does not apply pending migrations to an existing database. `db:seed` is local-only and uploads original fixture files as well as creating records.

After the first-time setup, start local Supabase and the web app with one command:

```bash
bun run devx
```

`devx` waits for Supabase startup and bucket provisioning to succeed before starting Next.js. Supabase runs in background containers; Next.js stays attached to your terminal. Use `bun run dev` when you only need the frontend.

For a fresh local demo, stop any running Next.js server with Ctrl+C, then run:

```bash
bun devrs
```

`devrs` starts local Supabase, resets its database and reapplies migrations/SQL seeds, provisions storage buckets, imports the nine fictional projects and their 27 originals, then starts Next.js. **This deletes existing local cases, chats, saved plans, and embeddings.** It explicitly targets the local database. Sample import makes no AI calls; semantic search needs the separate `bun run db:backfill --embed` command to rebuild embeddings. Use `bun run devx` for ordinary restarts that preserve data. See the [local reset guide](docs/features/case-library-and-ingestion.md#reset-the-local-demo).

Open the URL printed by the dev server (usually `http://localhost:3000`). Edit
`src/app/(workspace)/page.tsx` and save to see changes through Fast Refresh. Stop the server
with Ctrl+C; Supabase remains running. To choose another port, use `bun run devx --port 3001` (or `bun run dev --port 3001` for the frontend alone).

Open Supabase Studio at the URL printed by `db:status` (normally `http://127.0.0.1:54323`) to inspect local data and storage. Stop Supabase with `bun run db:stop`; this preserves local data. Each developer runs their own instance. The hosted demo's data and files are separate.

The homepage and manual case entry run without an AI key. **Read documents with AI** requires `OPENAI_API_KEY` in `.env.local`; optional `OPENAI_CASE_MODEL`, `AI_CASE_SESSION_LIMIT`, and `AI_CASE_DAILY_LIMIT` settings are documented in the [AI reading guide](docs/features/ai-assisted-case-reading.md). The model defaults to the pinned GPT-4.1 mini model in `.env.example`. Production defaults to 50 attempts per session and 100 attempts per UTC day across the database. `bun run dev` and `bun run devx` disable both attempt limits, even if the limit variables are present. A local production server (`bun run build` followed by `bun run start`) still enforces the production limits. Restart Next.js after changing environment settings. Live AI requests are billed even when the database is local.

For a hosted deployment, provision the same bucket using the declared configuration as part of a deliberate deployment step, such as `supabase seed buckets --linked` after linking the intended hosted project. The local startup command does not provision hosted storage.

## Project setup status

- [x] Set the package and lockfile workspace name to `rewoven`.
- [x] Set the site name and description from the local product brief; use English.
- [x] Confirm the Git remote points to `https://github.com/TaiVanNgo/rewoven.git`.
- [ ] On each machine, create `.env.local` using the quick-start instructions.
- [x] Replace the demo homepage and favicon with the product interface and branding.
- [x] Remove `MotionDemo` when replacing the homepage.
- [x] Establish shared workspace routes, shadcn primitives, and Light / Dark / System themes.
- [x] Implement session-isolated case browsing, keyword search, source inspection, and text/Markdown/PDF ingestion.
- [x] Implement optional OpenAI-assisted case reading, editable suggestions, source evidence, and saved review records.
- [x] Implement multi-document upload, resumable indexing, and request-to-case passage retrieval.
- [x] Read large and multiple documents with AI, resume saved progress, and review combined case metadata.
- [x] Implement dedicated case pages and editable evidence-backed project overviews.
- [x] Implement session-saved query conversations, cited case Q&A, related-case discovery, and request comparison.
- [x] Implement reuse-plan generation, request review, Markdown editing, explicit saves, and export.
- [x] Implement client request attachments.
- [x] Prepare nine related Threadline Delivery projects, 27 historical originals, two client inputs, and explicit full demo-library search.
- [ ] Set the production origin and deployment configuration before launch.
- [ ] Choose a project license before publishing; no root license is provided yet.

The New chat interface renders without database credentials; searching cases requires Supabase, and semantic search additionally requires an OpenAI key. The case library requires configured Supabase services. Manual entry does not need an AI API key; optional AI reading does. Add placeholder environment variables to `.env.example` as integrations are implemented, and keep real values in ignored `.env.local` or deployment configuration. `NEXT_PUBLIC_` values are exposed to the browser.

`AGENTS.md` contains the development workflow. Optional skills in `.agents/skills/` provide agent guidance; their presence does not install their recommended libraries. Review their licenses before redistributing them.

## Commands

| Command                          | Purpose                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `bun run dev`                    | Start development with Fast Refresh.                                                                 |
| `bun run devx`                   | Start local Supabase, provision storage, then start Next.js with Fast Refresh.                       |
| `bun run db:start`               | Start local Supabase and provision the declared storage bucket.                                      |
| `bun run db:migrate`             | Apply pending local migrations without resetting data.                                               |
| `bun run db:seed:production`     | Import samples only in Vercel Production with explicit opt-in; see the deployment guide.             |
| `bun run db:seed`                | Validate and activate nine curated project samples locally; retain legacy sources.                   |
| `bun run test`                   | Run focused validation, extraction, and session unit tests.                                          |
| `bun run test:case-reading:live` | Run billable staged reading of three fictional documents, including a source over 50,000 characters. |
| `bun run test:ai:live`           | Run one billable local OpenAI reading of a fictional PDF; verify save and evidence.                  |
| `bun run test:integration`       | Test local API persistence, AI reading isolation/cache/limits, and recovery without OpenAI calls.    |
| `bun run db:backfill`            | Backfill missing original sizes; add `--embed` for billable, resumable semantic indexing.            |
| `bun run test:retrieval:live`    | Evaluate semantic relevance against local fictional cases with billable query embeddings.            |
| `bun run db:status`              | Show local service URLs and credentials.                                                             |
| `bun run db:stop`                | Stop local Supabase while preserving local data.                                                     |
| `bun run lint`                   | Check Biome lint and import organization without writing fixes.                                      |
| `bun run format`                 | Apply Prettier formatting and sort Tailwind classes; review the resulting diff.                      |
| `bun run format:check`           | Check formatting and Tailwind class order without writing changes.                                   |
| `bun run typecheck`              | Generate Next.js route types, then check TypeScript without emitting JavaScript.                     |
| `bun run build`                  | Build the application for production.                                                                |
| `bun run build:vercel`           | Vercel build entry point; migrate hosted Supabase only inside Vercel Production.                     |
| `bun run start`                  | Serve the production build; run `build` first.                                                       |

`format` formats code and sorts Tailwind classes; address remaining lint or import organization findings separately. Next.js builds do not run Biome or Prettier, so lint and formatting are separate checks.

## Formatting and Tailwind class sorting

Prettier handles formatting through the official `prettier-plugin-tailwindcss` plugin. Biome's formatter is disabled; Biome still checks code quality and import organization. Run `bun run format` to format the project, or `bunx prettier --write 'src/app/(workspace)/page.tsx'` to format one file.

In VS Code or Cursor, install the recommended **Prettier - Code formatter** and **Biome** extensions. The committed `.vscode/settings.json` enables Prettier on save and Biome import organization on explicit saves. The CLI commands work without editor extensions.

The `tailwindStylesheet` option in `.prettierrc.json` points to `src/app/globals.css` so sorting includes the Tailwind v4 theme. If you move that stylesheet in a copied project, update this path. Keep `prettier-plugin-tailwindcss` last when adding other Prettier plugins. See the [official plugin documentation](https://github.com/tailwindlabs/prettier-plugin-tailwindcss).

Markdown prose wrapping is set to `preserve`, so formatting retains your existing paragraph line breaks. Generated files, lockfiles, and installed agent skills are excluded in `.prettierignore`. Keep `.prettierrc.json`, `.prettierignore`, and `.vscode/` when reusing the template.

## Project structure

```text
src/app/
  layout.tsx                Root HTML, fonts, theme/Motion providers, metadata
  (workspace)/
    layout.tsx              Shared workspace, draft provider, and query history
    page.tsx                Ask Wren chat (/)
    case-library/page.tsx   Searchable case library (/case-library)
    case-library/[id]/      Dedicated case overview, evidence, and source management
    saved-plans/            Saved plan list and individual editor (/saved-plans/[id])
  globals.css               Tailwind, light/dark tokens, focus and motion policy
  icon.png                  Portrait favicon
  robots.ts                 Crawler instructions
  sitemap.ts                Public route list, subject to indexing policy
  opengraph-image.tsx        Generated social-sharing image
src/components/
  ui/                       Shadcn primitives customized for Rewoven
  workspace/                Sidebar, shell, page header, logo, theme dropdown
  providers/                Theme and Motion providers
src/features/cases/          Library, source viewer, form, types, validation, extraction
  server/                   Supabase access, ownership, ingestion, sessions
src/app/api/                Session, case, retry, and authorized original-file routes
src/features/queries/          Saved chat, case focus, evidence, comparison, server workflow
src/features/plans/            Request review, evidence-backed plans, visual/Markdown editor and export
src/features/requests/
  request-composer.tsx       Form interactions and sample loading
  request-draft.tsx          Draft type, provider, and access hook
  request-samples.ts        Fictional request examples
src/lib/
  site.ts                   Site identity and indexing configuration
  seo.ts                    Per-page canonical/social metadata helper
  motion.ts                 Shared transition presets
  utils.ts                  Shared cn() utility
public/images/              rewoven-logo.png and wren.png
components.json             Shadcn style, aliases, and registry configuration
next.config.ts              Cache Components, prefetching, Tailwind integration
biome.json                  Linting and import organization
.prettierrc.json             Prettier and Tailwind class sorting
.prettierignore              Formatting exclusions
.vscode/                    Editor settings and recommendations
tsconfig.json               TypeScript; @/* resolves to src/*
AGENTS.md                   Agent development workflow
.agents/skills/             Optional agent guidance
supabase/                   Local configuration, migrations, and source fixtures
scripts/seed-cases.ts        Repeatable local or opted-in Vercel Production case/file import
tests/                      Unit tests, API integration suite, and PDF fixtures
docs/features/              Beginner-friendly implementation guides
```

The `(workspace)` route group organizes related pages without adding a URL segment. Its layout keeps the sidebar and request-draft provider mounted during client navigation. Pages and the shared shell remain Server Components; Client Components own form state, sidebar collapse, and theme controls. Add another workspace route under this group when it needs the same frame.

Request-specific UI and data live together in `src/features/requests/`. Generic controls live in `src/components/ui/`; shared workspace elements live in `src/components/workspace/`; cross-feature utilities live in `src/lib/`. Import modules directly instead of introducing barrel files or speculative folders.

The root layout loads Source Sans 3 for body text, Plus Jakarta Sans for headings and buttons, and JetBrains Mono for counters through `next/font/google`. Fonts are downloaded at build time and served locally to visitors. Font downloads require network access during a build; use local fonts if your build environment must work offline.

The workspace is capped at 1540px. At 1024px and above, navigation becomes a 270px sidebar that can collapse to a 76px rail. Below 1024px, it becomes a compact header with navigation. The request and Wren panels sit side by side from 1280px and stack below that. Constraints and sample cards stack on narrow screens.

`next.config.ts` enables Cache Components and Partial Prefetching and integrates Tailwind through `@tailwindcss/turbopack`. Read the installed Next.js docs before changing caching, runtime, or CSS configuration. The case library uses server-only Supabase access and anonymous cookie-backed sessions. Bun runs the unit and local API integration tests. `test:ai:live` is a separate, explicit billable OpenAI test. Account authentication is not implemented yet. `.github/workflows/ci.yml` runs code and database checks. `scripts/vercel-build.ts` and `vercel.json` define Vercel-owned production migrations and deployment; the hosted production flow still needs verification with deployment credentials.

## Shared UI with shadcn

The project uses the official shadcn registry, the `base-nova` style, Base UI primitives, and Lucide icons. `components.json` records the configuration. The current CLI initializes this style with `--preset nova --base base`; the resulting configuration calls it `base-nova`.

The UI primitives are source files owned by this repository, including Button, Input, Textarea, Field, Card, Empty, Badge, Separator, DropdownMenu, Dialog, Tabs, Alert, and Skeleton. Label is included as a dependency of Field. Base UI supplies interactive behavior, `class-variance-authority` supplies variants, and `cn()` merges conditional Tailwind classes. The `shadcn` and `tw-animate-css` stylesheet imports supply state variants and popup animations.

Use existing primitives and variants before adding custom control markup. Rewoven’s navigation, sample-button, card, and category-badge variants are defined centrally in the UI files. Compose forms with FieldGroup, Field, and labeled controls. Use real Next.js Link elements with `buttonVariants()` for navigation; keep Button for actions. Use `cn()` for conditional classes and Lucide icons with accessible labels on icon-only controls.

Before adding another component, check whether it already exists. Use the configured registry through Bun, for example `bunx --bun shadcn@latest add @shadcn/dialog`. Review generated files, preserve Rewoven’s styling, run `bun install`, and inspect both dependency and lockfile changes. Format the result and run the verification commands below. Do not reinitialize the project just to add a component.

## Themes and design tokens

Light / Dark / System is available through **Change theme** in every workspace page’s header. System is the default and follows live device preference changes. An explicit choice overrides the device and persists in local storage under `rewoven-theme`, including after a reload. Theme preferences use browser local storage; cases use Supabase and a session cookie. Request drafts stay in memory.

`src/components/providers/theme-provider.tsx` uses `next-themes` to apply a `light` or `dark` class before the page paints. The root HTML permits that intentional class/style difference during hydration. Theme changes disable color transitions temporarily to avoid unrelated elements fading at different speeds.

`src/app/globals.css` defines light values in `:root` and dark values in `.dark`, then exposes them as Tailwind semantic tokens. The light theme keeps the pale canvas, white panels, charcoal text, and lime accents. The dark theme uses deep green-gray surfaces and pale text, with dark text on lime primary actions. Inputs, muted text, badges, dropdowns, disabled states, and focus indicators use those same variables.

Customize shared tokens or primitive variants for appearance; reserve page-level classes for layout. Keep the established fonts, named radii, and spacing scale. The supplied portrait is used unchanged for the sidebar logo and favicon; the existing full Wren illustration remains separate.

## Animations with Motion

The project includes [`motion`](https://motion.dev/docs/react-installation). `bun install --frozen-lockfile` installs the recorded versions of Motion and the UI dependencies; no additional Next.js configuration is needed.

`src/components/providers/motion-provider.tsx` wraps route content in MotionConfig. Presets in `src/lib/motion.ts` use a 180ms interaction transition and a 240ms sidebar transition. CSS control transitions and dropdown animations use the same 180ms timing and interface easing.

Motion responds to user actions: subtle press feedback and sidebar width changes. There is no automatic page-load entrance sequence. Wren’s first-message handoff runs only after submission. `initial={false}` keeps content visible before hydration, and the composer wraps shadcn Button with `motion.create()` for press feedback.

`reducedMotion="user"` respects the visitor’s device preference. Chat loading indicators respect reduced motion. The sidebar sets its transition duration to zero under reduced motion, and a global CSS media query disables CSS transitions and animations, including dropdown animations.

Run `bun run dev` and open the printed URL. Send a message, attach cases, navigate between pages, toggle the sidebar, and change themes. Repeat with reduced motion enabled in your device or browser settings. Stop the server with Ctrl+C.

## SEO setup

The starter uses Next.js's built-in Metadata API. `src/lib/site.ts` is the source of truth for site name, description, HTML language, and Open Graph locale. The root layout supplies a title template, shared social metadata, and the indexing policy. `src/app/opengraph-image.tsx` generates a 1200 × 630 PNG preview from the same name and description; customize it for each project's branding.

Copy `.env.example` to `.env.local` and set `SITE_URL` to your actual origin, including `https://`. Use an origin with no path, query, fragment, or credentials. Leave `SITE_INDEXABLE=false` for the starter, staging sites, and internal apps. For a public production deployment, set it to `true` after replacing the starter content. These variables are read during the build: configure them in your deployment service and rebuild when they change.

Without `SITE_URL`, canonical URLs and `og:url` are omitted, and social image URLs use `http://localhost:3000` for local development. To check images on another local port, set `SITE_URL` to that local origin and keep indexing off. `SITE_INDEXABLE=true` requires `SITE_URL`; development and Vercel preview builds still emit `noindex, nofollow`. Other hosting services should set `SITE_INDEXABLE=false` explicitly for their preview and staging builds. Indexing controls guide search engines; use authentication for private content.

`robots.txt` allows crawling so search engines can read the page's `noindex` tag. It advertises the sitemap only when indexing is enabled. `/sitemap.xml` is empty while indexing is disabled; when enabled, it lists all three workspace routes. Add each new public route to `src/app/sitemap.ts`; for dynamic content, use actual published URLs and modification dates rather than generating timestamps on every build. [Google's noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing) explains why blocking crawling would prevent search engines from seeing the tag.

For each new public page, export metadata with the helper and its own site-relative path. It keeps the page title, description, canonical URL, and social metadata aligned; the root layout intentionally has no homepage canonical for child routes to inherit.

```tsx
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "About",
  description: "A description of this page's actual content.",
  path: "/about",
});
```

Add this to a real `src/app/about/page.tsx` when you create the route. With a configured origin, its title becomes `About | Rewoven` and its canonical points to `/about`. The helper includes complete Open Graph and Twitter fields because Next.js replaces nested metadata objects rather than deeply merging them. The generated image is inherited until you add a page-specific image file. For dynamic routes, call the same helper from `generateMetadata` using the resolved page data.

Before launch, inspect the deployed page source for title, description, canonical URL, Open Graph/Twitter tags, image URLs, and robots metadata. Check `/robots.txt`, `/sitemap.xml`, and the social image URL. Confirm that production URLs use the real domain and that indexing is enabled for public pages. After deployment, verify the domain in Google Search Console and submit its sitemap; local checks cannot establish whether Google has indexed the site.

## Verify before sharing or deploying

```bash
bun run test
bun run lint
bun run format:check
bun run typecheck
bun run build
bun run start
```

Check the production page at the printed URL, including mobile layout, keyboard
navigation, Light / Dark / System themes, preference persistence, retained drafts, and reduced motion. Stop the development server before serving
production on the same port, or use `bun run start --port 3001`. Use `dev` while
editing and `build` followed by `start` to verify production behavior.

With configured local Supabase and the app running, use `bun run test:integration` to verify the API workflow. It creates and cleans up its own sessions and files. Set `TEST_BASE_URL=http://localhost:3001` when checking a production server on that port.

## Working with an AI agent

`AGENTS.md` defines the agent's workflow. Ask the agent to read it and this README
before making changes. Include the feature you want, who will use it, and any
constraints. For example:

> Build [feature] for Rewoven's audience. Read AGENTS.md and
> README.md first. Complete the project setup checklist where my brief supplies the
> information, identify any missing decisions, and implement [first feature].
> Explain the relevant files and commands as you work, then verify the result and
> tell me how to run it locally.

Use the product brief for project-specific decisions. Keep this README aligned with actual commands and
configuration as the project grows.
