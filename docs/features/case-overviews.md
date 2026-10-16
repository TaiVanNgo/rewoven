# Reading a case with evidence

Open **Case library**, search for `Harbor`, and open **Harbor Route Planning Pilot**. The first section explains the important result and its limit: route preparation improved in a two-depot pilot, observed over ten business days. **Recorded results** gives the actual measurements. **Gaps and conflicting evidence** explains what those measurements do not establish.

Select a source button beside a finding. At desktop widths of 1280px and above, its quote appears beside the case. Smaller screens use a dialog; Escape closes it and returns focus to the citation. The inspector names the source version and physical PDF page and links to the original. A matching quote is evidence to inspect, not proof that an AI interpretation is correct.

## Set up and inspect

Complete the [README setup](../../README.md#quick-start), preserving your existing `.env.local`, then run:

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:migrate
bun run db:seed
bun run dev
```

Open the printed URL, usually `http://localhost:3000/case-library`. Stop Next.js with Ctrl+C; `bun run db:stop` separately stops local Supabase without deleting its data. On later runs, `bun run devx` starts both services. Apply migrations after pulling schema changes.

For production-mode local verification, run `bun run build` before `bun run start --port 3001`. The build prepares the application that the production server serves. Neither command deploys the app or updates hosted Supabase.

## What each section means

- **Case at a glance:** the important takeaway, with its evidence boundary.
- **Problem and constraints:** why the work existed and what limited it.
- **Approach and key decisions:** what the documents say the team built, proposed, or chose.
- **Recorded results:** actual documented observations, including failures. A target is not an achieved result.
- **Lessons and reusable material:** documented lessons and artifacts, without invented files or links.
- **Gaps and conflicting evidence:** limitations and unresolved disagreements. Conflicting results stay out of the actual-outcome projection until resolved.

Empty sections say **Not documented**. Cases created before structured overviews keep their saved context, outcome, and lessons. The migration does not invent a story for them. They can use **Read case with AI** or **Write overview** when the owner wants to prepare one.

## Create, review, and correct

For your own case, add one or more supported documents. AI reading is optional and billable when configured. It reads all accepted documents in saved stages and prepares the metadata and six overview sections. Review the findings and their quotes before confirming.

**Edit overview** supports manual entry without an AI key. Each section allows up to four findings of 600 characters. An edited or newly written finding becomes a **Contributor note · Evidence not verified** and loses inherited AI citations. Unchanged findings retain server-stored evidence; submitting a forged citation does not replace it. Blank editor rows are omitted when saved.

A refreshed AI draft stays separate from the confirmed overview. The review dialog lets you compare it and choose **Use new overview, keeping my notes**. Existing contributor corrections are retained; each section remains limited to four findings. Saving checks the previous case fields and overview revision together. If another tab saved first, reload the saved overview before applying edits again.

Adding a document marks the old overview as needing refresh. Read again to include the new material; the previous overview and original AI reading remain available until confirmation. Old completed reading records remain inspectable. In-progress readings from the old schema require a fresh reading rather than resuming incompatible checkpoints.

## Files and data flow

The App Router maps `src/app/(workspace)/case-library/[id]/page.tsx` to a dedicated case URL. Its Server Component supplies the route and metadata; small Client Components handle session requests, editing, progress, and the source inspector. Suspense boundaries allow runtime URL information to load under Next.js Cache Components. Individual cases are excluded from the sitemap and emit noindex metadata; API responses use private, no-store caching.

The flow is: original documents → page-aware extracted text → staged AI findings with excerpt IDs → server-resolved exact quotes → review → confirmed overview plus legacy metadata projections. Retrieval still searches original passages; a summary does not replace them.

| File                                                                                  | Purpose                                                                                       |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [case-overview.ts](../../src/features/cases/case-overview.ts)                         | Shared overview shape, section limits, review provenance, projections, and refresh detection. |
| [server/case-reading.ts](../../src/features/cases/server/case-reading.ts)             | Saved reading stages, original-source synthesis, review, and atomic persistence.              |
| [case-detail.tsx](../../src/features/cases/case-detail.tsx)                           | Case narrative, section links, evidence panel/dialog, and Sources.                            |
| [case-workspace.tsx](../../src/features/cases/case-workspace.tsx)                     | One session and processing worker shared across library/detail navigation.                    |
| [case_overviews migration](../../supabase/migrations/202610160004_case_overviews.sql) | Additive overview columns, optimistic locking, and sample activation.                         |
| [sample-catalog.ts](../../scripts/sample-catalog.ts)                                  | Checksum and citation validation for the prepared samples.                                    |

Search is stored in `?q=` and returned by **Back to case library**. Original links using `?case=...` forward to the dedicated route with their source, page, and character range. Source references inside overviews use `?finding=...&ref=...`, so reload and browser history can restore an inspector.

## Replacing the sample catalog

The nine public cases use the five PDFs and first four Markdown files in [the supplied pack](../../output/pdf/rewoven-test-pack/README.md). The fifth Markdown file is the non-project control used by tests. Original document bytes are unchanged. The curated overview manifest contains the prepared text and quotes; the pack README and answer key are not source documents and are never sent to AI by seeding.

`bun run db:seed` validates all source checksums and quotes before importing anything. Stable case keys and checksum-based source IDs make retries idempotent. Original uploads are never overwritten, and existing chunk IDs/embeddings are preserved. All nine cases become visible together after successful import. A failed import leaves the old catalog active; run the command again to resume.

Only the known legacy sample IDs are retired from library browsing, retrieval, and coverage counts. Their records and originals remain accessible through existing citation links. Session-owned cases and unrelated seeds are not retired. Historical SQL migrations remain unchanged.

Ordinary seeding makes no AI or embedding calls. The prepared samples work with keyword search. `bun run db:backfill --embed` is a separate billable operation for semantic indexing; it skips retired samples. Hosted replacement remains an explicit `SEED_SAMPLE_CASES=true` Vercel Production operation described in the [deployment guide](ci-cd-and-production.md#import-the-fictional-samples-into-production).

## Verification and limits

Unit tests validate curated quotes, source checksums, physical page references after Watershed's blank page, bounded findings, non-project shapes, and edited-claim provenance. Integration tests cover persistence, revision conflicts, stale sources, session isolation, sample immutability, interrupted catalog replacement, reruns, retained originals, and legacy citation links.

Verification passed 52 unit tests, 10 local API/database integration tests, lint, formatting, type checking, and production compilation. Production-browser checks covered 390, 768, 1024, and 1440px in light/dark themes, citation focus restoration, original PDF links, preserved search, legacy passage highlighting, manual create/edit/reload, added-source refresh state, and keeping a mocked AI draft open for review.

The structured AI transport and persistence are tested with mocked model responses. This does not establish live model accuracy for all ten documents. Paid live reading and retrieval evaluation remain explicit separate commands. The catalog is fictional and provides no evidence of real organizational demand or measured application benefits. OCR, request comparisons, reuse-plan editing, and plan persistence remain outside this refactor.
