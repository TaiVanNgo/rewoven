# Agent workflow

## Start with the repository

- Read `README.md` for setup, the first-use checklist, and development versus
  production commands. Check `package.json` and the relevant configuration before
  choosing commands or adding dependencies.
- Inspect the current code and Git diff; preserve changes already made by the user.
- Determine whether the task changes this reusable starter or a project created
  from it. Keep starter changes broadly reusable; use the project's brief for
  product-specific content and dependencies.
- When asked to initialize a new project, follow the README's first-use checklist.
  Complete items supported by the user's brief and identify missing decisions;
  avoid inventing names, branding, credentials, or deployment details.

## Teach while building

- Explain the purpose of the files and commands involved in the current task in
  concise, plain language. Connect each explanation to the change being made.
- For setup guidance, explain how to install dependencies, start development,
  inspect the result, and stop the server. For production guidance, explain why
  the build must precede the production server. Use the commands in the README.
- For features, explain relevant Next.js concepts such as file-based routing or
  the Server/Client Component boundary as they arise. Scale explanations to the
  user's questions rather than repeating a full tutorial for every edit.
- Finish with what changed, why, verification results, and the next command or
  browser action the user needs. Distinguish verified behavior from assumptions
  and checks that could not run.

## Develop and verify

- Use Bun and retain `bun.lock`. After intentional dependency or package-name
  changes, run `bun install` and review the lockfile diff; use frozen installation
  when reproducing an unchanged dependency set.
- Use Prettier for formatting and Tailwind class sorting, and Biome for linting
  and import organization. Keep Biome's formatter disabled. Run the README's
  formatting command after edits and include the formatting check in verification.
  Preserve Markdown paragraph line breaks and keep imported agent skills untouched.
- Follow the existing App Router, TypeScript, and Tailwind conventions.
  Keep Server Components as the default and place client boundaries where
  interactivity needs them. Add shared folders and libraries when the feature
  requires them.
- This starter enables Cache Components and Partial Prefetching. Before changing
  caching, runtime, or CSS integration, consult the corresponding installed docs
  named in the generated Next.js instructions below.
- For documentation-only changes, verify file references and documented commands.
  For code or configuration changes, run lint, type checking, and a production
  build using the README's commands; check changed UI in the browser. Add focused
  tests for meaningful behavior when appropriate. Report failures accurately.
- Keep README instructions current when setup, commands, structure, or required
  configuration changes. Store only placeholders in environment examples; keep
  secrets in ignored local files or deployment configuration.

## SEO changes

- Read the README's SEO setup before changing metadata or adding public routes. Use `src/lib/site.ts` for shared identity and `createPageMetadata` for each page's title, description, canonical, and social metadata. Add actual public routes to the sitemap and keep modification dates tied to content changes.
- Configure the real site origin and indexing policy for each deployment. Verify emitted HTML, `/robots.txt`, `/sitemap.xml`, and social image responses; distinguish local verification from deployed behavior and search-engine indexing.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
