# Purchasing demo verification - 18 October 2026

This is a local fictional-demo record, not a production certification or accuracy benchmark. Keep it outside uploaded evidence.

The original rehearsal below used an opt-in demo-library switch. The MVP now includes the nine projects in the default Case library; see the unified-library follow-up at the end of this record.

## Corpus and indexing

- Nine active projects from one fictional software delivery company, Threadline Delivery, for different fictional clients.
- Three originals per project: 27 historical sources. The new Northbank client PDF and constraints note are separate chat inputs: 29 input files total.
- All files passed the app's extraction path. Ten PDFs contain two physical pages each, with selectable text and no extraction warnings.
- All 20 PDF pages were rendered and visually inspected. Final deterministic PDF files were rendered again and matched the inspected pages pixel for pixel.
- Two independent pack builds produced identical historical-source checksums and manifest entries.
- The configured local database has nine active cases, 27 indexed sources, and 54 of 54 chunks with embeddings. Older samples are hidden from browsing and collection discovery; retained original citation links remain available. User cases are preserved.

## Automated checks

- 124 unit tests passed across 21 files.
- All 16 API/database integration tests passed across 12 files with mocked provider stages.
- Formatting, Biome lint, TypeScript checks, and a production build passed.
- Integration coverage includes interrupted/repeated seeding, three originals per case, old citation access, private-case preservation, nine-case scope, excluded private/retired sources, restored contexts, and plan inheritance.
- Regression tests reproduce and prevent planner shortlists silently restricting discovery, old citation IDs leaking into later prompt history, and plan output schemas admitting client-request IDs as historical references.

## Live provider and browser checks

- Semantic retrieval found the labelled historical case in the top three for 9 of 9 prepared matching requests. Both unrelated requests returned no results. These are small, deliberately authored fictional examples; they do not establish real-world accuracy or robustness to every misleading request.
- The browser uploaded both client files into a fresh chat with Use demo library selected. Both completed extraction and AI reading, and the answer connected purchasing, expense retries, branch permissions, and audit history.
- Original historical PDF citations opened the intended physical page with readable source text. Request references remained separate from historical case references.
- Live request preparation reached the review form. Human review restored important distinct-actor and edit-invalidation rules that the generated summary omitted, and recorded the requested four-week window without treating it as a proven estimate.
- Live plan generation succeeded using the corrected provider reference schema and the normal processing service. The browser then edited the plan, explicitly saved it, reloaded it, and downloaded Markdown with retained historical excerpts and separate Request document references.
- Human edits qualified the application event log's limits, corrected rejection wording, and added a proposed pilot-test checklist and finance-assignment meeting. The original AI draft remains separately retained by the app.
- Browser checks covered 1440 px desktop and 390 px mobile, light and dark views, scope visibility, source inspection, and saved-plan editing/export. Measured mobile document width was 390 px at a 390 px viewport; there was no horizontal overflow. Chrome reported CSS-preload warnings, with no browser runtime errors in the final checks.

## Failures found during rehearsal

An early follow-up stayed with a previous three-project shortlist and overclaimed what revision checks proved. Discovery now keeps the allowed collection available unless the user explicitly names a narrower scope. Old answer citation IDs and fact labels are no longer included in the next model history. A fresh chat is preferable after these fixes because old saved answers are intentionally not rewritten.

Initial plan attempts used request-document citation IDs where the historical plan map expected case IDs. Validation rejected the draft and preserved the confirmed request. The provider schema now restricts plan markers to supplied historical IDs; client references remain separate. The corrected live processing run reached Ready, and browser save/reload/export checks then passed.

## Limits to disclose

The five-minute walkthrough is a presentation target after setup, not a measured latency guarantee. No repeated median analysis benchmark or maximum-capacity test was performed for this pack. Answers use a bounded evidence selection and may group claims under citations that need closer inspection. A valid reference ID does not prove every sentence is supported. Review summaries, recommendations, exclusions, and original evidence before presenting them as decisions.

The hosted app, hosted migrations, hosted sample import/indexing, and GitHub CI were not verified in this run. Local seeding and indexing do not change production. Google Drive sharing is left to the folder owner. Do not distribute local session links, cookies, credentials, or private rehearsal exports in the share pack.

## Unified-library follow-up - 18 October 2026

The nine active historical projects and each session's historical uploads now share the default Case library scope. The demo-library switch and separate picker tabs have been removed. Shared seeded records remain read-only and fictional; another session's uploads and retired samples remain excluded from collection discovery. Existing saved answers retain their original evidence and wording.

The regression uploads the real Northbank PDF and constraints Markdown in a fresh session without historical uploads or manual scope selection. With mocked provider stages, it verifies real extraction/storage, both request documents reaching Wren, historical evidence across all nine projects, mixed request/historical citations, restored scope, and plan generation with separate request references. It also verifies the database retrieval boundary directly and checks that adding an owned case joins it to the library.

All 129 unit tests, all 16 integration tests, formatting, lint, type checks, and a production build passed. Browser checks covered the single nine-case picker, optional five-case narrowing, returning to the full library, Northbank attachments, the default submission payload, and 1440 px/390 px light/dark layouts. The browser deliberately intercepts submission before AI processing; the integration suite covers the persisted request-to-plan flow with mocked providers. These checks do not establish live-model answer quality or hosted deployment behavior. No paid AI calls were made for this follow-up.
