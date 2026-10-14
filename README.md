# Rewoven

Rewoven helps delivery teams find relevant past projects, understand what changes this time, and build a reuse plan with sources they can check.

The project contains a responsive New request interface built with Next.js, TypeScript, Tailwind CSS, and Motion, using Prettier, Biome, and Bun. It is a frontend preview: case ingestion, retrieval, AI analysis, and plan persistence are not implemented yet. The local product brief is in `SRS.md`, which is ignored by Git.

The homepage includes the request composer, optional constraints, three fictional sample requests, Wren’s illustration, and a collapsible desktop sidebar. Samples populate and focus the textarea; blank requests are blocked and requests are limited to 10,000 characters. **Find past cases** shows an inline message explaining that retrieval is not connected. Case library and Saved plans show availability messages rather than opening another page. Requests and constraints remain in the current page only and reset on reload; nothing is sent to a backend or saved to browser storage.

To inspect this interface without starting Supabase, install dependencies with `bun install --frozen-lockfile`, then run `bun run dev`. Open the URL printed by Next.js, usually `http://localhost:3000`. Try a sample, edit the request and constraints, and select **Find past cases**. On desktop, use the sidebar toggle to collapse or expand navigation. Stop the dev server with Ctrl+C.

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

`db:start` starts Supabase and creates or updates the private `case-sources` bucket with a 5 MB upload limit from `supabase/config.toml`. You do not need to create the bucket in Studio manually. This command explicitly targets local storage, and can be rerun after a normal stop. The first startup downloads the container images and can take several minutes. Local migrations and `supabase/seed.sql` run during initial database creation; an ordinary restart preserves the existing database.

After the first-time setup, start local Supabase and the web app with one command:

```bash
bun run devx
```

`devx` waits for Supabase startup and bucket provisioning to succeed before starting Next.js. Supabase runs in background containers; Next.js stays attached to your terminal. Use `bun run dev` when you only need the frontend.

Open the URL printed by the dev server (usually `http://localhost:3000`). Edit
`src/app/page.tsx` and save to see changes through Fast Refresh. Stop the server
with Ctrl+C; Supabase remains running. To choose another port, use `bun run devx --port 3001` (or `bun run dev --port 3001` for the frontend alone).

Open Supabase Studio at the URL printed by `db:status` (normally `http://127.0.0.1:54323`) to inspect local data and storage. Stop Supabase with `bun run db:stop`; this preserves local data. Each developer runs their own instance. The hosted demo's data and files are separate.

The current homepage runs without an AI key. Real AI calls will require each developer's own API credentials when the integration is implemented. Live AI requests are billed even when the database is local.

For a hosted deployment, provision the same bucket using the declared configuration as part of a deliberate deployment step, such as `supabase seed buckets --linked` after linking the intended hosted project. The local startup command does not provision hosted storage.

## Project setup status

- [x] Set the package and lockfile workspace name to `rewoven`.
- [x] Set the site name and description from the local product brief; use English.
- [x] Confirm the Git remote points to `https://github.com/TaiVanNgo/rewoven.git`.
- [ ] On each machine, create `.env.local` using the quick-start instructions.
- [x] Replace the demo homepage and favicon with the product interface and branding.
- [x] Remove `MotionDemo` when replacing the homepage.
- [ ] Implement case ingestion, retrieval, AI analysis, and plan persistence; choose and configure the AI provider before building that integration.
- [ ] Set the production origin and deployment configuration before launch.
- [ ] Choose a project license before publishing; no root license is provided yet.

The current foundation does not need database credentials or an AI API key to run. Add placeholder environment variables to `.env.example` as integrations are implemented, and keep real values in ignored `.env.local` or deployment configuration. `NEXT_PUBLIC_` values are exposed to the browser.

`AGENTS.md` contains the development workflow. Optional skills in `.agents/skills/` provide agent guidance; their presence does not install their recommended libraries. Review their licenses before redistributing them.

## Commands

| Command                | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `bun run dev`          | Start development with Fast Refresh.                                             |
| `bun run devx`         | Start local Supabase, provision storage, then start Next.js with Fast Refresh.   |
| `bun run db:start`     | Start local Supabase and provision the declared storage bucket.                  |
| `bun run db:status`    | Show local service URLs and credentials.                                         |
| `bun run db:stop`      | Stop local Supabase while preserving local data.                                 |
| `bun run lint`         | Check Biome lint and import organization without writing fixes.                  |
| `bun run format`       | Apply Prettier formatting and sort Tailwind classes; review the resulting diff.  |
| `bun run format:check` | Check formatting and Tailwind class order without writing changes.               |
| `bun run typecheck`    | Generate Next.js route types, then check TypeScript without emitting JavaScript. |
| `bun run build`        | Build the application for production.                                            |
| `bun run start`        | Serve the production build; run `build` first.                                   |

`format` formats code and sorts Tailwind classes; address remaining lint or import organization findings separately. Next.js builds do not run Biome or Prettier, so lint and formatting are separate checks.

## Formatting and Tailwind class sorting

Prettier handles formatting through the official `prettier-plugin-tailwindcss` plugin. Biome's formatter is disabled; Biome still checks code quality and import organization. Run `bun run format` to format the project, or `bunx prettier --write src/app/page.tsx` to format one file.

In VS Code or Cursor, install the recommended **Prettier - Code formatter** and **Biome** extensions. The committed `.vscode/settings.json` enables Prettier on save and Biome import organization on explicit saves. The CLI commands work without editor extensions.

The `tailwindStylesheet` option in `.prettierrc.json` points to `src/app/globals.css` so sorting includes the Tailwind v4 theme. If you move that stylesheet in a copied project, update this path. Keep `prettier-plugin-tailwindcss` last when adding other Prettier plugins. See the [official plugin documentation](https://github.com/tailwindlabs/prettier-plugin-tailwindcss).

Markdown prose wrapping is set to `preserve`, so formatting retains your existing paragraph line breaks. Generated files, lockfiles, and installed agent skills are excluded in `.prettierignore`. Keep `.prettierrc.json`, `.prettierignore`, and `.vscode/` when reusing the template.

## Project structure

```text
src/app/
  layout.tsx       Root HTML layout, fonts, and default metadata
  page.tsx         Home route (/)
  globals.css      Tailwind import, theme tokens, and global styles
  icon.svg         Rewoven brand icon used by browser tabs
  robots.ts        Crawler instructions and sitemap discovery
  sitemap.ts       Public route list for search engines
  opengraph-image.tsx  Generated social-sharing image
src/lib/
  site.ts          Shared site identity and indexing configuration
  seo.ts           Per-page canonical and social metadata helper
  motion.ts        Shared interaction and sidebar transition presets
  request-samples.ts  Fictional request examples and category styles
src/components/
  motion-provider.tsx  Shared animation defaults and reduced-motion policy
  workspace-sidebar.tsx  Responsive navigation, collapse, and preview feedback
  request-composer.tsx   Request fields, sample loading, and submission feedback
  preview-action.tsx     Wren’s case-library preview action
  icon.tsx              Local decorative SVG icons
public/            Static assets, including rewoven.svg and images/wren.jpg
next.config.ts     Next.js and Tailwind/Turbopack configuration
biome.json         Linting and import organization configuration
.prettierrc.json    Prettier and Tailwind class-sorting configuration
.prettierignore     Files excluded from formatting
.vscode/            Editor settings and extension recommendations
tsconfig.json      TypeScript configuration; @/* resolves to src/*
AGENTS.md          Workflow instructions for coding agents
.agents/skills/    Optional guidance for compatible coding agents
supabase/         Local service configuration, migrations, and seed data
```

Add a route with a file such as `src/app/about/page.tsx`. Use `src/components/`
for shared UI or `src/lib/` for shared logic when needed. Keep pages and layouts as
Server Components by default; use `"use client"` for components that need state,
event handlers, or browser APIs.

Tailwind v4 theme tokens live in `src/app/globals.css`. Rewoven uses a consistent light theme even when the system prefers dark mode: a pale green-gray canvas, white panels, charcoal text, and lime accents. Semantic utilities such as `bg-surface-soft`, `text-ink-muted`, `border-line`, and `rounded-panel` keep components aligned. Shared `.field` and `.action` classes standardize form controls; focus and selection styles apply globally.

The root layout loads Source Sans 3 for body text, Plus Jakarta Sans for headings and buttons, and JetBrains Mono for counters through `next/font/google`. Fonts are downloaded at build time and served locally to visitors. Font downloads require network access during a build; use local fonts if your build environment must work offline.

The workspace is capped at 1540px. At 1024px and above, navigation becomes a 270px sidebar that can collapse to a 76px rail. Below 1024px, it becomes a compact header with navigation. The request and Wren panels sit side by side from 1280px and stack below that. Constraints and sample cards stack on narrow screens. The page and root layout remain Server Components; only stateful controls use Client Components, and the static Wren panel is passed into the composer as server-rendered content.

`next.config.ts` enables Cache Components and Partial Prefetching and integrates
Tailwind through `@tailwindcss/turbopack`. Read the installed Next.js docs before
changing caching, runtime, or CSS configuration; older examples may use different
APIs. Authentication, databases, shadcn components, test runners, and CI workflows
are not configured in this baseline.

## Animations with Motion

The project includes [`motion`](https://motion.dev/docs/react-installation), the current Motion for React package. `bun install --frozen-lockfile` installs the recorded version; no additional Next.js or Tailwind configuration is needed.

`src/components/motion-provider.tsx` wraps route content in `MotionConfig` through the root layout. Presets in `src/lib/motion.ts` use a 180ms interaction transition and a 240ms sidebar transition, with the same easing used by CSS hover states. Reuse these presets and the global theme tokens when adding controls.

Motion is limited to responses to user actions: slight button press feedback and sidebar width changes. There is no automatic entrance sequence, and `initial={false}` keeps content visible before hydration. CSS handles color and border transitions. The sidebar expands when a collapsed navigation action needs to show preview feedback.

`reducedMotion="user"` respects the visitor’s device preference. The composer uses `useReducedMotion` to remove press transforms and use immediate scrolling when loading samples. The sidebar sets its transition duration to zero under reduced motion, and a global CSS media query disables CSS transitions and animations. Keep the same policy for future animated components.

Run `bun run dev` and open the printed URL. Try a sample, press the enabled search button, and toggle the desktop sidebar. Repeat with reduced motion enabled in your device or browser settings. Stop the server with Ctrl+C.

## SEO setup

The starter uses Next.js's built-in Metadata API. `src/lib/site.ts` is the source of truth for site name, description, HTML language, and Open Graph locale. The root layout supplies a title template, shared social metadata, and the indexing policy. `src/app/opengraph-image.tsx` generates a 1200 × 630 PNG preview from the same name and description; customize it for each project's branding.

Copy `.env.example` to `.env.local` and set `SITE_URL` to your actual origin, including `https://`. Use an origin with no path, query, fragment, or credentials. Leave `SITE_INDEXABLE=false` for the starter, staging sites, and internal apps. For a public production deployment, set it to `true` after replacing the starter content. These variables are read during the build: configure them in your deployment service and rebuild when they change.

Without `SITE_URL`, canonical URLs and `og:url` are omitted, and social image URLs use `http://localhost:3000` for local development. To check images on another local port, set `SITE_URL` to that local origin and keep indexing off. `SITE_INDEXABLE=true` requires `SITE_URL`; development and Vercel preview builds still emit `noindex, nofollow`. Other hosting services should set `SITE_INDEXABLE=false` explicitly for their preview and staging builds. Indexing controls guide search engines; use authentication for private content.

`robots.txt` allows crawling so search engines can read the page's `noindex` tag. It advertises the sitemap only when indexing is enabled. `/sitemap.xml` is empty while indexing is disabled; when enabled, it lists the homepage. Add each new public route to `src/app/sitemap.ts`; for dynamic content, use actual published URLs and modification dates rather than generating timestamps on every build. [Google's noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing) explains why blocking crawling would prevent search engines from seeing the tag.

For each new public page, export metadata with the helper and its own site-relative path. It keeps the page title, description, canonical URL, and social metadata aligned; the root layout intentionally has no homepage canonical for child routes to inherit.

```tsx
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "About",
  description: "A description of this page's actual content.",
  path: "/about",
});
```

Add this to a real `src/app/about/page.tsx` when you create the route. With a configured origin, its title becomes `About | Your project` and its canonical points to `/about`. The helper includes complete Open Graph and Twitter fields because Next.js replaces nested metadata objects rather than deeply merging them. The generated image is inherited until you add a page-specific image file. For dynamic routes, call the same helper from `generateMetadata` using the resolved page data.

Before launch, inspect the deployed page source for title, description, canonical URL, Open Graph/Twitter tags, image URLs, and robots metadata. Check `/robots.txt`, `/sitemap.xml`, and the social image URL. Confirm that production URLs use the real domain and that indexing is enabled for public pages. After deployment, verify the domain in Google Search Console and submit its sitemap; local checks cannot establish whether Google has indexed the site.

## Verify before sharing or deploying

```bash
bun run lint
bun run format:check
bun run typecheck
bun run build
bun run start
```

Check the production page at the printed URL, including mobile layout, keyboard
navigation, reduced motion, and the consistent light appearance under both system color preferences. Stop the development server before serving
production on the same port, or use `bun run start --port 3001`. Use `dev` while
editing and `build` followed by `start` to verify production behavior.

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
