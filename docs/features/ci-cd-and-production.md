# CI/CD and production releases

Rewoven has two things to release: the Next.js application on Vercel, and its database schema and storage configuration on Supabase. The workflows keep them in order so the new API has the tables it needs before it becomes the live site.

## A concrete example

Suppose you add saved plans. On a feature branch, create a migration with `supabase migration new add_saved_plans`, write the SQL in the generated file, run `bun run db:migrate` locally, and implement the UI and API. Commit the migration alongside the feature.

Opening a pull request starts **CI / Checks**. It installs the locked dependencies, checks formatting, lint, types, and unit tests, starts a disposable local Supabase stack, applies migrations, imports fictional fixtures, builds the app, and runs the existing API integration tests. AI responses in those tests are mocked; the workflow does not run `test:ai:live` or receive production credentials.

The first CI setup also includes migration `202610150005_case_reservation_conflicts.sql`. Integration testing exposed a race where two identical submissions could collide on the session/request unique constraint and return 503. The migration handles both unique constraints; a regression test checks that simultaneous reservations still create one case and one source. Production receives this fix through the same migration step as future features.

After you merge into `main`, **Production** runs the same checks again for the merged commit. Its release job follows this sequence:

1. Validate the production settings and reject a commit that is no longer the tip of `main`.
2. Verify the configured Vercel project and owner, pull its production configuration, and build the application.
3. Link the intended hosted Supabase project, show pending migrations, apply them, and provision buckets declared in `supabase/config.toml`.
4. Deploy that production build to a unique Vercel URL with `--skip-domain`. The existing deployment keeps serving `rewoven.dev`.
5. Verify the staged deployment is Ready and targets Production. Check its homepage, then call `/api/demo-session` to confirm the API can write to the production database.
6. Confirm the commit is still current, then promote the tested deployment to `https://rewoven.dev`.

Each step must succeed before the next can run. A production concurrency group prevents two release workflows from running together. GitHub may replace an older pending run with a newer one; it does not cancel a running release. The commit checks also reject an outdated manual rerun.

## Important files

| File                               | Purpose                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/ci.yml`         | Checks pull requests; also runs as a reusable workflow before production releases.                                                                                                               |
| `.github/workflows/production.yml` | Releases the tested `main` commit to Supabase and Vercel in order.                                                                                                                               |
| `vercel.json`                      | Disables direct Git deployments from `main`, preventing a parallel Vercel deployment from skipping migration checks. Other branches retain automatic previews. CLI deployments remain available. |
| `supabase/migrations/`             | Versioned SQL changes; Supabase tracks which ones have already run.                                                                                                                              |
| `supabase/config.toml`             | Declares the private `case-sources` bucket and its upload limit.                                                                                                                                 |
| `package.json` and `bun.lock`      | Define the commands and exact application dependencies used by CI.                                                                                                                               |

The application still uses Next.js Route Handlers under `src/app/api/` for the backend. They deploy with the pages; there is no separate backend server to start in GitHub Actions after deployment. `bun run start` in CI runs the production build temporarily on the runner for integration testing. On your computer, use `bun run devx` for normal development, or `bun run build` followed by `bun run start` to inspect production behavior. Stop Next.js with Ctrl+C and local Supabase with `bun run db:stop`.

## One-time GitHub setup

Do this before merging the workflow setup. The repository is [TaiVanNgo/rewoven](https://github.com/TaiVanNgo/rewoven).

1. Open **Settings → Environments → New environment** and create `production`.
2. Restrict deployment branches to `main`. Protect `main` with pull requests and required CI checks so only reviewed code reaches the credential-bearing job. Select the Checks job reported by GitHub after its first run.
3. Configure required reviewers for the environment when available. If enabled, the release job waits for approval, then runs migrations and deployment automatically. Your GitHub plan and repository rules determine which protection settings are available.
4. Add the following values to that environment. Paste secret values directly into GitHub; keep them out of code, chat, and `.env.example`.

| Kind     | Name                    | Where to get it                                                                                                                                                                             |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variable | `SUPABASE_PROJECT_REF`  | Production Supabase dashboard URL: the value after `/project/`.                                                                                                                             |
| Variable | `VERCEL_ORG_ID`         | The owner/team ID of the existing Vercel project.                                                                                                                                           |
| Variable | `VERCEL_PROJECT_ID`     | The existing Rewoven Vercel project's ID.                                                                                                                                                   |
| Secret   | `SUPABASE_ACCESS_TOKEN` | Create a scoped token in Supabase account settings for this production project. It needs the reads required by `supabase link`, database migration access, and Storage bucket write access. |
| Secret   | `SUPABASE_DB_PASSWORD`  | The production project's PostgreSQL password; this is different from an API key.                                                                                                            |
| Secret   | `VERCEL_TOKEN`          | Create a Vercel token with access to the team and existing project that owns `rewoven.dev`.                                                                                                 |

You can obtain the Vercel IDs by deliberately linking your existing project locally with the pinned CLI:

```bash
bunx vercel@64.2.0 login
bunx vercel@64.2.0 link
```

Choose the existing Rewoven project and its owner. Read `orgId` and `projectId` in the resulting `.vercel/project.json`. This file is ignored by Git. Do not create another Vercel project during linking. The workflow writes its link from the configured IDs and verifies the remote project before pulling configuration.

No production credentials belong in `ci.yml`. The CI runner generates `.env.local` from its own local Supabase and discards it when the runner finishes. The production job receives deployment secrets only in the steps that need them. Action revisions and CLI versions are pinned in the workflow files; Bun follows `package.json` and Node uses version 22. Update pins deliberately and rerun the checks when upgrading.

## One-time Vercel and Supabase checks

In the existing Vercel project, confirm the Git production branch is `main` and set the Node.js version to **22.x** under Build and Deployment settings. The production job checks this version because Vercel's runtime must match the Node version that created the prebuilt output. Keep branch preview deployments connected to staging services, with separate credentials. The config disables only `main` Git deployments; direct dashboard deploys, CLI commands, other workflows, and external deploy hooks can still bypass this release sequence, so use this workflow for production releases.

Configure the application variables in **Vercel → Project Settings → Environment Variables → Production**:

| Variable                                       | Purpose                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                 | Production project's HTTPS API URL. Verify it corresponds to `SUPABASE_PROJECT_REF` in GitHub. |
| `SUPABASE_SECRET_KEY`                          | Server-only application key from that same project.                                            |
| `OPENAI_API_KEY`                               | Dedicated production key if enabling AI reading; manual entry works without it.                |
| `OPENAI_CASE_MODEL`                            | Optional model override; see `.env.example` for the default.                                   |
| `AI_CASE_SESSION_LIMIT`, `AI_CASE_DAILY_LIMIT` | Optional production AI attempt limits.                                                         |
| `SITE_URL`                                     | `https://rewoven.dev`; store as a readable Config value so the production build can use it.    |
| `SITE_INDEXABLE`                               | Keep `false` while the demo is unfinished; store as Config.                                    |

Production application secrets remain in Vercel. GitHub only needs deployment credentials, not your OpenAI key or the application's Supabase key. Pulled production configuration may omit Secret values; the current build does not query Supabase or call OpenAI while prerendering, and Vercel supplies the application secrets to deployed Functions at runtime. Do not introduce build-time database access without revisiting this setup.

The CLI's `vercel curl` command handles Vercel Deployment Protection for the checked staging URL using the authenticated project context. If the project's protection policy blocks automation, the smoke check fails and the deployment stays unpromoted; resolve the project's automation access and rerun instead of removing the check. The workflow does not follow HTTP redirects or print session cookies. It creates one ordinary 24-hour demo session per successful smoke check. Session expiry currently does not delete records automatically.

The bucket provisioning step does not import fictional sample cases. `bun run db:seed` remains local-only; hosted fixture import is a separate task.

## Everyday use

For application changes, open a pull request and inspect its CI result and Vercel preview. For schema changes, include a new SQL migration and test it locally first:

```bash
supabase migration new add_saved_plans
# Edit the new SQL file, then:
bun run db:migrate
bun run test
bun run test:integration
```

The integration command requires local Supabase configured, seeded, and an app server running. The [case library guide](case-library-and-ingestion.md) explains the setup. Apply pending schema changes through new migration files rather than editing ones already applied to production. Keep migrations compatible with the currently running app: add a replacement column first, deploy code that uses it, migrate existing values, then remove the old column in a later release.

After merging, open **GitHub → Actions → Production** to follow the checks and release steps. The successful release writes the commit, deployment URL, and live site URL to the run summary. Open `https://rewoven.dev/case-library` and manually confirm small-file ingestion, original-source access, and any changed behavior. The automatic session check is a connection check, not a complete production feature test.

To retry after fixing a missing setting or temporary outage, rerun the failed job for the latest `main` commit. You can also choose **Actions → Production → Run workflow → main**. Dispatching from another branch runs checks but cannot enter the production release job. Migration history causes already-applied migrations to be skipped.

## Failure behavior and limits

- Failed CI, missing settings, an incorrect Vercel project, or a failed production build stops the release before migrations.
- A migration or storage provisioning failure stops deployment. Earlier successful migrations may already be applied; inspect history and make a forward repair rather than assuming the entire release rolled back.
- Failed staging or smoke checks keep the existing site live, but database changes remain applied. Promotion failure also requires checking Vercel's actual domain assignment: a CLI timeout can occur while promotion continues remotely.
- A Vercel rollback restores application code, not database schema or stored data. This is why migrations must remain compatible with the previous code.
- The current 5 MB app upload allowance exceeds Vercel's documented 4.5 MB request-body limit. CI's local integration tests do not reproduce Vercel's gateway limit. Full 5 MB uploads still need direct-to-storage uploads or a lower app limit.
- Supabase storage changes, migration SQL, and application changes are not one atomic transaction. This workflow provides ordering and failure gates, not a database rollback system.
- Do not cancel a production run while it is applying migrations. Let it finish or fail, inspect both platforms, and release the latest commit after correcting the problem.

## Verification

Before committing workflow changes, run formatting and the repository checks:

```bash
bun run format
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

Workflow YAML can be checked with [actionlint](https://github.com/rhysd/actionlint): `actionlint .github/workflows/ci.yml .github/workflows/production.yml`. Run the API integration suite against local Supabase and a local production server as described above. These checks verify local behavior and workflow structure. The first GitHub runner execution, credential permissions, production migrations, Vercel build output, protection access, and promotion require a real hosted run; local validation cannot establish those outcomes.

References: [Supabase environment and CI setup](https://supabase.com/docs/guides/deployment/managing-environments), [Vercel branch deployment configuration](https://vercel.com/docs/project-configuration/git-configuration), [Vercel staged deployments](https://vercel.com/docs/cli/deploy#skip-domain), and [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments).
