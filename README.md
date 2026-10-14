# Rewoven

Rewoven helps delivery teams find relevant past projects, understand what changes this time, and build a reuse plan with sources they can check.

The project currently contains the Next.js foundation with TypeScript, Tailwind CSS, Motion, Prettier, Biome, and Bun. The homepage is still the starter demo; case ingestion, retrieval, AI analysis, and plan persistence are not implemented yet. The local product brief is in `SRS.md`, which is ignored by Git.

## Quick start

Install Node.js 20.19 or newer (required by the Tailwind Prettier plugin) and the Bun version specified in `package.json` (`packageManager`). Bun manages dependencies and scripts; Next.js runs on Node.js.

From the project root:

```bash
bun install --frozen-lockfile
cp .env.example .env.local # First setup only; preserve an existing .env.local.
bun run dev
```

For local development, set `SITE_URL=http://localhost:3000` and keep `SITE_INDEXABLE=false` in `.env.local`. If you change the server port, update the local origin to match. Next.js loads this file automatically; it is ignored by Git.

Open the URL printed by the dev server (usually `http://localhost:3000`). Edit
`src/app/page.tsx` and save to see changes through Fast Refresh. Stop the server
with Ctrl+C. To choose another port, use `bun run dev --port 3001`.

## Project setup status

- [x] Set the package and lockfile workspace name to `rewoven`.
- [x] Set the site name and description from the local product brief; use English.
- [x] Confirm the Git remote points to `https://github.com/TaiVanNgo/rewoven.git`.
- [ ] On each machine, create `.env.local` using the quick-start instructions.
- [ ] Replace the demo homepage and favicon with the product interface and branding.
- [ ] Remove `MotionDemo` and unused demo assets when replacing the homepage.
- [ ] Choose and configure the database and AI provider before building those integrations.
- [ ] Set the production origin and deployment configuration before launch.
- [ ] Choose a project license before publishing; no root license is provided yet.

The current foundation does not need database credentials or an AI API key to run. Add placeholder environment variables to `.env.example` as integrations are implemented, and keep real values in ignored `.env.local` or deployment configuration. `NEXT_PUBLIC_` values are exposed to the browser.

`AGENTS.md` contains the development workflow. Optional skills in `.agents/skills/` provide agent guidance; their presence does not install their recommended libraries. Review their licenses before redistributing them.

## Commands

| Command                | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `bun run dev`          | Start development with Fast Refresh.                                             |
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
  favicon.ico      Default icon to replace for each project
  robots.ts        Crawler instructions and sitemap discovery
  sitemap.ts       Public route list for search engines
  opengraph-image.tsx  Generated social-sharing image
src/lib/
  site.ts          Shared site identity and indexing configuration
  seo.ts           Per-page canonical and social metadata helper
src/components/
  motion-provider.tsx  Shared animation defaults and reduced-motion policy
  motion-demo.tsx      Removable interactive animation example
public/            Static assets served from the site root
next.config.ts     Next.js and Tailwind/Turbopack configuration
biome.json         Linting and import organization configuration
.prettierrc.json    Prettier and Tailwind class-sorting configuration
.prettierignore     Files excluded from formatting
.vscode/            Editor settings and extension recommendations
tsconfig.json      TypeScript configuration; @/* resolves to src/*
AGENTS.md          Workflow instructions for coding agents
.agents/skills/    Optional guidance for compatible coding agents
```

Add a route with a file such as `src/app/about/page.tsx`. Use `src/components/`
for shared UI or `src/lib/` for shared logic when needed. Keep pages and layouts as
Server Components by default; use `"use client"` for components that need state,
event handlers, or browser APIs.

Tailwind theme tokens live in `src/app/globals.css`. The starter follows the
system's light/dark preference and uses Geist fonts through `next/font/google`.
Font downloads require network access during a build; use local fonts if your
build environment must work offline.

`next.config.ts` enables Cache Components and Partial Prefetching and integrates
Tailwind through `@tailwindcss/turbopack`. Read the installed Next.js docs before
changing caching, runtime, or CSS configuration; older examples may use different
APIs. Authentication, databases, shadcn components, test runners, and CI workflows
are not configured in this baseline.

## Animations with Motion

The starter includes [`motion`](https://motion.dev/docs/react-installation), the current package for Motion for React (formerly Framer Motion). It was installed with `bun add motion`; running `bun install --frozen-lockfile` installs it alongside the other dependencies in a copied project. No additional Next.js or Tailwind configuration is needed.

`src/components/motion-provider.tsx` wraps the route content in `MotionConfig` through the root layout. It sets a default transition of 0.6 seconds with `easeInOut` easing and `reducedMotion="user"` to respect the visitor's device setting. Components can override the transition for quicker interactions, as the demo button does. Reduced motion disables transform and layout animations; opacity and color animations can still run. Use `useReducedMotion` when a component needs to disable those effects too.

Keep interactive animations in small Client Components. Import components and hooks from `motion/react` inside a file with `"use client"`, then render that component from a Server Component page. Passing route content through the provider's `children` keeps pages and layouts as Server Components.

For example, create `src/components/animated-card.tsx`:

```tsx
"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export function AnimatedCard({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={false} whileHover={{ y: -4 }}>
      {children}
    </motion.div>
  );
}
```

Import `AnimatedCard` into a page and wrap its content with `<AnimatedCard>...</AnimatedCard>`. `initial={false}` skips an entrance animation and keeps the content visible in the initial HTML. Keep essential content readable before hydration and with JavaScript disabled; avoid defaulting it to `opacity: 0` just to animate it into view.

Run `bun run dev`, open the printed URL, and select **Replay animation** to try the homepage demo. The square rotates and the button responds to hover and press. With the device's reduced-motion setting enabled, those transforms are disabled. Stop the server with Ctrl+C. Remove `MotionDemo` when replacing the placeholder homepage; retain the provider for your own animations. See the [Motion component documentation](https://motion.dev/docs/react-motion-component) for animation props and [MotionConfig](https://motion.dev/docs/react-motion-config) for shared defaults.

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
navigation, and light/dark appearance. Stop the development server before serving
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
