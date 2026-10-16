# CI checks and Vercel production releases

Vercel owns Rewoven's production deployment, including the step that applies pending SQL migrations to hosted Supabase. GitHub Actions runs tests and code checks. Production credentials stay in Vercel.

## Example: adding saved plans

On a feature branch, create a migration with `supabase migration new add_saved_plans`, write the SQL in the generated file, and apply it locally with `bun run db:migrate`. Implement the UI and API against local Supabase, then commit the migration alongside the feature.

Opening a pull request starts GitHub's **CI / Checks** job. It installs locked dependencies, checks formatting, lint, types, and unit tests, starts disposable local Supabase, applies migrations, imports fictional fixtures, builds the app, and tests the API. AI responses are mocked. CI does not receive production credentials or run the billable `test:ai:live` command.

Vercel builds a preview for the branch. The preview runs the application build and skips hosted migrations, even if deployment credentials were accidentally supplied to it. Backend previews need their own staging database and schema; this setup does not provision staging infrastructure automatically.

When the change merges into `main`, Vercel's production build runs:

1. Validate the production migration settings. The standard `SUPABASE_URL` must match `SUPABASE_PROJECT_REF`, and a supplied Git branch must be `main`.
2. Run `bun run build`. A compilation failure stops before touching production Supabase.
3. Use the pinned Supabase CLI through `npx --yes supabase@2.120.0` to link the intended project, run `db push --linked --yes`, and provision declared buckets with `seed buckets --linked --yes`.
4. Return success so Vercel can publish the frontend and API together. A failed migration or bucket command fails the build and prevents this deployment from being published.

Supabase's migration history causes already-applied migration files to be skipped on later builds. Redeploys rerun the migration check and bucket provisioning. The current build does not query application tables during prerendering; future features must preserve that boundary or revisit the ordering.

## Files and responsibilities

| File                         | Purpose                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`   | Runs checks on pull requests and pushes to `main`; supports manual checks too.                                                                |
| `vercel.json`                | Sets the frozen install and `build:vercel` command, leaves normal Git deployments enabled, and disables automatic cancellation of Git builds. |
| `scripts/vercel-build.ts`    | Builds the app and runs hosted migrations only when `VERCEL=1` and `VERCEL_ENV=production`.                                                   |
| `tests/vercel-build.test.ts` | Checks environment isolation, target validation, command ordering, and stopping after a failure without contacting production.                |
| `supabase/migrations/`       | Versioned SQL changes tracked by Supabase.                                                                                                    |
| `supabase/config.toml`       | Declares the private `case-sources` bucket and its upload limit.                                                                              |

Next.js Route Handlers under `src/app/api/` are the backend. They deploy with the pages. There is no separate production backend server to start after deployment. The previous GitHub production-release workflow is removed; no GitHub `production` environment, Vercel token, or Vercel project IDs are required by these workflows.

## One-time Vercel setup

Use the existing Vercel project that owns `https://rewoven.dev`, connected to [TaiVanNgo/rewoven](https://github.com/TaiVanNgo/rewoven), with `main` as the production branch.

In **Project Settings → Environment Variables**, add these values for **Production only**:

| Name                    | Where to find it / purpose                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_PROJECT_REF`  | The value after `/project/` in the production Supabase dashboard URL.                                                                              |
| `SUPABASE_ACCESS_TOKEN` | A scoped Supabase account token for linking this project and managing its storage buckets. Grant only the permissions needed for those operations. |
| `SUPABASE_DB_PASSWORD`  | This project's PostgreSQL password; it is different from the app's API key.                                                                        |

Keep the existing application variables in Vercel Production too:

| Name                                           | Purpose                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                 | Use the standard `https://PROJECT_REF.supabase.co` API origin for the same project. Custom API domains are not supported by the build guard. |
| `SUPABASE_SECRET_KEY`                          | Server-only application key for that project.                                                                                                |
| `OPENAI_API_KEY`                               | Dedicated production key if enabling AI reading; manual entry works without it.                                                              |
| `OPENAI_CASE_MODEL`                            | Optional model override; `.env.example` lists the default.                                                                                   |
| `AI_CASE_SESSION_LIMIT`, `AI_CASE_DAILY_LIMIT` | Optional production AI attempt limits.                                                                                                       |
| `SITE_URL`                                     | `https://rewoven.dev`.                                                                                                                       |
| `SITE_INDEXABLE`                               | Keep `false` while the demo is unfinished.                                                                                                   |

Store the access token, database password, and API keys as Secrets. Paste credentials directly into Vercel rather than into code or chat. Do not copy production credentials into `.env.local`, GitHub, or Preview environments. The commented deployment settings in `.env.example` are placeholders for discoverability; local development does not need them.

Confirm that Vercel automatically exposes system environment variables to builds, so the script can distinguish Production from Preview. `vercel.json` sets **Install Command** to `bun install --frozen-lockfile` and **Build Command** to `bun run build:vercel`. Keep those commands when changing dashboard settings. Node 22.x matches the CI runtime; Bun follows `package.json`.

Git builds are configured to run in sequence without automatically cancelling an in-flight build. Leave Vercel's project build queue enabled, including when on-demand concurrent builds are available. Avoid starting overlapping manual production deployments or migrations: this script does not implement a cross-process database lock. If the CLI reports a concurrent migration/history conflict, let the active release finish, inspect migration history, and rerun the newest deployment.

After adding the variables, merge the follow-up change and inspect the new Vercel production deployment. Build logs should show `[vercel-build] Applying production migrations and storage configuration.` followed by the completion message. A preview should instead show that hosted migrations were skipped.

## GitHub checks and release gates

GitHub Actions has no production variables or secrets in this setup. If you added credentials for the removed release workflow, they are no longer used; remove them once you confirm nothing else depends on them.

Protect `main` with pull requests and require the **Checks** job to pass before merging. The fresh checks on a push to `main` run independently of Vercel: merely adding the workflow does not make Vercel wait for those checks. If production domain assignment must also wait for the checks on the merged commit, configure the project's [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks). These checks gate publication, not the database changes already made during the build.

## Everyday commands

Normal local setup and usage stay the same:

```bash
bun install --frozen-lockfile
bun run devx
```

Configure and seed local Supabase first using the [README quick start](../../README.md#quick-start). `devx` starts Supabase, provisions local storage, and starts Next.js. Open the printed localhost URL. Ctrl+C stops Next.js; `bun run db:stop` stops local Supabase while preserving its data.

For schema changes:

```bash
supabase migration new add_saved_plans
# Edit the new SQL file, then:
bun run db:migrate
bun run test
bun run test:integration
```

The integration command needs configured and seeded local Supabase plus a running app. Use new migration files instead of editing migrations already applied to production. Keep new SQL compatible with the live app: add a replacement column, deploy code that uses it, migrate existing values, and remove the old column in a later release.

To inspect a local production build, run `bun run build` followed by `bun run start`. Building prepares the optimized output; starting serves it. `bun run build:vercel` also builds locally but skips hosted migrations outside Vercel Production. Do not simulate Vercel Production locally with real production credentials.

After a hosted release, open `https://rewoven.dev/case-library`, add a small text case, reload, and open its original source. Check any changed functionality and Vercel runtime logs. The new flow relies on Vercel's build result and your application verification; it does not retain the removed GitHub workflow's staged smoke-test/promotion steps.

## Failure behavior and verification limits

- Missing settings, a mismatched project, or an unsuccessful application build stops before migrations.
- A migration or bucket-provisioning failure prevents the new deployment from publishing. Earlier successful migrations can remain applied; an application rollback does not undo database changes.
- A cancelled build or later Vercel deployment failure can also leave schema changes applied while the old app remains live. Database changes and deployment are not one atomic transaction.
- Fixture seeding is still local-only. Provisioning buckets does not import the ten fictional sample cases into production.
- Local integration tests do not reproduce Vercel's request-body limit. Full 5 MB uploads still need direct-to-storage uploads or a lower app limit.
- The pinned CLI package is downloaded through `npx` during a production build; the build needs network access to the package registry, Supabase CLI binary download, and hosted Supabase. It does not start local Docker services on Vercel.

Run `bun run format`, `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build` when editing this setup. The guard tests use injected commands, so they verify that preview builds cannot migrate and failures stop the sequence without running production commands. The integration suite verifies schema and API behavior with local Supabase. An actual Vercel production build with correctly scoped credentials is still needed to verify hosted database permissions, networking, and publication.

References: [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables), [Vercel Git build configuration](https://vercel.com/docs/project-configuration/git-configuration), and [Supabase CLI setup](https://supabase.com/docs/guides/cli/getting-started).
