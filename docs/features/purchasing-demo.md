# Purchasing demo: one company, nine projects, one new client

Threadline Delivery is a fictional software delivery company. Its nine historical projects were delivered or proposed for different fictional clients. Northbank Services is a new client asking for a purchasing tool. The story is: **we have solved parts of this before; what should we reuse, adapt, clarify, and avoid?**

The downloadable pack lives in [`output/pdf/rewoven-purchase-demo/`](../../output/pdf/rewoven-purchase-demo/README.md). It contains 27 historical sources, two client inputs, and a separate presenter guide. The [five-minute walkthrough](../../output/pdf/rewoven-purchase-demo/presenter-only/story-and-walkthrough.md) explains the story without requiring technical background. All names, incidents, and results are invented; this is not evidence of real organizational impact.

## Understand the nine projects

| Project                         | Why it is in the archive                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Office Purchasing Pilot         | Closest delivered workflow: single-manager approval tied to a request revision.                                        |
| Expense Reimbursement Portal    | A lost response caused duplicate submissions; a database-enforced operation key fixed the tested record-creation path. |
| Supplier Onboarding Workspace   | Separates document collection and review from spending authority; not automatically in Northbank's scope.              |
| Invoice Matching Pilot          | Failed matching led to manual fallback. Completing the business cycle did not mean the automation succeeded.           |
| Branch Inventory Request Portal | Checks current branch assignments on server reads and writes.                                                          |
| Audit Export Dashboard          | Records event provenance and export boundaries without claiming formal compliance.                                     |
| Staff Leave Approval Tool       | Shows time-bounded delegation; purchasing delegation still needs a client decision.                                    |
| Marketing Content Approval Tool | An editorial review flow is a partial match, not a financial authorization engine.                                     |
| Purchasing Expansion Proposal   | Discusses finance routing but was never implemented.                                                                   |

Each project contains `project-brief.md`, `implementation-notes.md`, and a two-page `delivery-review.pdf`. The brief explains intended scope, the notes describe decisions and examples, and the review records outcomes and limits. A requirement in a brief is not proof that it shipped. For the proposal, all implementation and test discussion remains explicitly prospective.

## Prepare local development

Use the Node.js and Bun versions in the README. Configure ignored `.env.local` for **local** Supabase and OpenAI; start a Docker-compatible runtime. Do not copy hosted credentials into local configuration.

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:migrate
bun run db:seed
# Billable: creates missing embeddings for the active samples and active uploads.
bun run db:backfill --embed
bun run dev
```

`db:migrate` installs the catalog activation guard. `db:seed` validates every original checksum, extracts all 27 files, validates curated overview quotes, creates searchable chunks, and publishes the nine projects together. It makes no AI calls. Backfill creates missing semantic embeddings without replacing originals or chunk identities. Confirm indexing finishes before rehearsing; a Ready source can still have pending embeddings and fall back to keyword search.

Open the printed URL, usually `http://localhost:3000`. Stop Next.js with Ctrl+C. Supabase stays available until `bun run db:stop`, which preserves local data. For a production-mode local check, run `bun run build` before `bun run start`; the server needs the compiled build.

## Try the judge's journey

1. Open a fresh chat. The default **Searching Case library** scope already includes all nine Threadline projects and any historical cases uploaded in this session. No demo switch or manual case selection is needed. **Add cases** optionally narrows a question to up to five projects; **Search full library** returns to collection-wide discovery.
2. Choose **Upload files** and select `client-brief.pdf` and `constraints.md` from the pack's `upload/Client input/` folder. These describe new work and belong in chat, not Case library.
3. Send: “Which previous projects help with this request? Explain what we can reuse, what changes, and what is still unknown.” File reading begins on Send. The nine cases are eligible for discovery; the answer uses a bounded set of original passages, not every document in full.
4. Inspect citations for the purchasing revision rule and the expense retry incident. A historical PDF citation opens its physical page; client citations are labelled as request documents.
5. Ask: “What can we learn from our past projects about preventing duplicate submissions when a connection drops after Send?” This tests discovery beyond the first answer's cases. Inspect the reimbursement sources. Ask why the marketing approval tool is insufficient and whether the expansion was implemented if time permits.
6. Choose **Draft reuse plan**, review the request, and generate. Check the inclusive VND 10 million threshold, manager-then-finance order, distinct actors, edits invalidating approval, retry behavior, branch permissions, and scoped event export. Inspect references rather than accepting a plausible answer on appearance alone.
7. Edit a next step to schedule a meeting with the finance-assignment owner. **Save**, reload the plan, and **Export Markdown**. Retention, delegation, assignment ownership, and peak traffic should remain questions where no answer was supplied.

For an optional upload demonstration, use a separate session: create ONE case from the three files in ONE historical project folder. Review the AI overview before confirming. Never combine all 27 sources into one case, upload the ZIP directly, or upload presenter answers as evidence. The preloaded catalog already contains these sources; manual recreation is optional and does not improve the built-in records.

## What changed in the app

The default `{ mode: "library", caseIds: [] }` now searches active seeded history and historical cases owned by the current session. Seeded records retain their shared, read-only ownership and fictional provenance; they are available in the same library rather than copied into every session. Other sessions’ uploads and retired samples remain excluded from discovery. The case picker shows a single combined list. Explicit attachments retain their exclusive scope and the five-case limit. Older `samples` inputs are accepted as an alias for library mode, and stored snapshots remain readable.

Migration `202610180002_unified_case_library.sql` updates the database retrieval function, while `assistant-retrieval.ts` and `process-assistant.ts` apply the same collection boundaries to source coverage and the case-name catalog. The default has no five-case discovery limit. Pages remain Server Components; the existing chat and picker Client Components own interactive selection. This replaces the earlier opt-in demo scope. New turns and newly generated plans use the updated library; old answers are retained, not automatically regenerated.

A planner's candidate list cannot silently lock a collection-wide follow-up to cases from an earlier answer. Only explicitly named projects may narrow discovery; attached cases retain their exclusive scope. The live rehearsal exposed this failure on a retry question, and the integration regression deliberately supplies a misleading three-case planner shortlist while checking that all nine remain eligible. The answer prompt also distinguishes revision checks from evidence of duplicate-create prevention. These safeguards improve evidence access and instructions; they do not prove factual entailment for every generated sentence.

Earlier assistant replies remain conversational prose in model context, but their citation IDs and fact labels are removed. Citation IDs are local to each turn's retrieved bundle; reusing an old `e3` beside a newly retrieved `e3` could otherwise encourage an incorrect source association. Saved answers retain their original references for display. This change does not revalidate or rewrite old answers; start a fresh chat when rehearsing after a prompt or retrieval fix.

Plan generation constrains output reference IDs to its historical evidence map at the provider schema as well as in server validation. Client requirements still inform generation, but `r_` request-document IDs cannot be emitted as historical plan markers. Their excerpts remain in the plan's separate request-reference collection and export. A live rehearsal exposed this mismatch; the request was preserved while invalid output was rejected, and a transport regression now checks the permitted IDs.

`scripts/sample-catalog.ts` now validates multiple originals and resolves every overview reference to its document. `scripts/seed-cases.ts` uploads each source and preserves immutable source/chunk identities on retries. An additive migration strengthens atomic activation: all nine projects need three Ready sources with chunks and a three-source overview. Activation retires previous shared samples from browsing and new discovery without deleting original citation targets or user cases. Old saved answers and direct citation links retain their evidence.

Next.js pages remain Server Components. The existing chat Client Component owns the scope button because it needs browser state and click handling. Credentials, source selection, model calls, and database writes remain server-side. Changing scope during processing uses the existing revision/conflict rules.

## Rebuild and share the pack

The checked-in files are ready to use. To regenerate, use Python 3 with `reportlab` installed:

```bash
python3 scripts/demo/build-pack.py
bun run format
bun test tests/sample-catalog.test.ts
```

The generator uses `scripts/demo/purchase-projects.json`, produces deterministic PDFs, and updates the manifest and two ZIP files. Rebuilding is an intentional source change: inspect the generated diff and revalidate PDF layout and citations. Use the PDF skill's render-and-inspect workflow. No Python package is added to the app's runtime dependencies.

An unchanged rebuild preserves source identities. For an intentional change to historical originals, version the catalog namespace before reseeding; do not overwrite retained originals or edit an already-applied migration. The activation guard requires exactly the three intended Ready documents per project. Keep older citation targets available when publishing the new version.

- `rewoven-purchasing-inputs.zip` contains only the 29 source/input files, grouped by project.
- `rewoven-purchasing-complete-pack.zip` also contains the README and clearly separated presenter material.

Upload the complete extracted folder or complete ZIP to Google Drive yourself. Judges need only the two client input files to use the preloaded app. Historical source folders let them inspect or recreate the projects. Check that the shared folder permits view/download from a signed-out browser. Google Drive distributes the files; it is not connected to Rewoven.

## Hosted rollout

The local database and hosted database are separate. Use the existing Vercel production release workflow: apply the migration and temporarily enable `SEED_SAMPLE_CASES=true` to import the new catalog, then disable the flag after success. Follow [CI/CD and production](ci-cd-and-production.md) for exact environment setup and import guards. Do not simulate production locally with hosted credentials.

Embedding the hosted originals is a separate billable operation with the existing guarded backfill tool and matching project reference. Source seeding alone does not establish semantic-index coverage. Verify the hosted demo-library scope, source downloads, and request-to-export journey after deployment.

## Verification and limits

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
# With seeded local Supabase and the app running:
bun run test:integration
# Explicit billable checks against the current local corpus:
bun run test:retrieval:live
```

Tests cover nine three-source cases, original quote/page validation, new request extraction, interrupted/repeated import, retired citation access, uploaded-case preservation, nine-case discovery, private/retired-source exclusion, scope restoration, and plan scope inheritance. Mocked provider tests establish boundaries and persistence, not model quality. Live retrieval checks assess the small fictional corpus. See the pack's `presenter-only/verification.md` for the current run's measured results and limitations.

The unified-library regression uploads both real Northbank inputs in a fresh session with no historical uploads or scope selection. It checks that Wren receives request evidence and all nine projects as eligible history, that the plan retains both kinds of evidence, and that another session's cases and retired records remain excluded. Adding a historical case joins it to the same library. Provider stages are mocked; extraction, storage, retrieval, snapshots, and plan persistence use local Supabase.

For browser verification after starting the app, run:

```bash
bunx @playwright/cli --session unified-library open http://localhost:3000
bunx @playwright/cli --session unified-library run-code --filename tests/unified-library.browser.js
bunx @playwright/cli --session unified-library close
```

Use the port printed by Next.js. The browser check covers the default scope, all nine cases in one picker, optional five-case narrowing and returning to the full library, both client attachments, and the actual submission payload. It also checks desktop/mobile light/dark layouts. Submission is intercepted before AI processing; the integration test verifies the full persisted request-to-plan flow with mocked providers. Stop the server with Ctrl+C when finished. This workspace check dismisses onboarding; the separate [onboarding walkthrough](onboarding.md) verifies the welcome story and first-visit behavior.

The five-minute script excludes setup and assumes reasonable provider latency. It is a presentation budget, not a performance guarantee. Citation existence alone does not prove sentence support; manually inspect historical claims. The fictional pack cannot prove organizational demand, legal compliance, production reliability, or guaranteed delivery in four weeks.
