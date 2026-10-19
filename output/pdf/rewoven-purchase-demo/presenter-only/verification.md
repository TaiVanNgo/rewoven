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

## Engineering-evidence follow-up - 19 October 2026

This update was implemented and activated locally only. No hosted deployment, hosted migration, hosted seeding, or hosted indexing was performed. All histories, incidents, and outcomes remain fictional. The engineering reconstructions explain designs; they are not nine runnable applications.

### Corpus and original-source checks

- Nine active version 2 cases, each with its original three-document structure and approximately 2,360–2,510 words across the three sources. Implementation notes now explain architecture, data relationships, API contracts, SQL/pseudocode, success/failure traces, operational tradeoffs, and primary technical references.
- The historical originals contain no Northbank-specific rules or threshold. Northbank's unchanged client PDF and constraints note remain separate chat inputs. The failed invoice pilot and paused expansion retain their original statuses.
- All 27 current sources are Ready and semantically indexed: 103 of 103 current passages have embeddings. Indexing finished with zero reported failures. Local embedding and Wren rehearsals made billable provider requests.
- The version 2 catalog identity includes a manifest digest. Repeated import preserves identities; source changes create a fresh complete catalog. Prior records and original files remain retained. Integration checks exercised actual version 1 originals, old downloads, interrupted/repeated publication, and preservation of session-owned cases.
- All 18 regenerated historical review pages were rendered and visually inspected. Reviews still have two physical pages, exact curated quotes, and no extraction warnings. The unchanged client inputs retain their existing requirements and page references.
- Two unchanged final pack rebuilds were compared for original-source, manifest, and ZIP reproducibility.

### Application verification

- 153 unit tests passed across 25 files.
- 23 local API/database integration tests passed across 14 files with mocked model stages. They include scoped unsupported-answer handling, one bounded draft revision for current requirements, keyword access to all nine projects, and discovery beyond an unsolicited planner shortlist.
- Biome lint, formatting check, TypeScript checks, production build, and Git whitespace checks passed. The new keyword migration was applied only to local Supabase. It prevents English query lexemes from being stemmed twice.
- The production-mode browser regression passed at 1440 px desktop and 390 px mobile in light/dark themes and reduced motion. It checked copied code and diagram source, four supported diagram types, discarded presentation-only style lines, malformed/hostile fallback, inert script-looking code, inline source inspection, reload, keyboard scrolling, and no mobile document overflow. No browser runtime errors were recorded in the final check.
- The browser test uses a saved live-answer fixture plus clearly labelled synthetic rendering fixtures. It intercepts conversation/plan-list requests and uses real retained local sources for citation viewing. It does not establish live generation quality or hosted behavior.

### Live answer checks and remaining limitations

The rehearsal exercised one technical question per case, a Northbank cross-case design, an editorial mismatch, and an unsupported quantum question through the actual Wren planner/retrieval/review/answer pipeline. All nine case-specific questions passed the prepared mechanism/cited-case checks. The mismatch and unsupported scenarios also passed. The full rehearsal passed 11 of 12 automated quality checks; the cross-case answer exposed raw evidence IDs in prose. Targeted reruns after generation/schema changes passed the prepared structural checks. These are small authored examples, not an accuracy benchmark.

Spot checks found useful detail in revision-bound transactions, employee-scoped operation keys and payload conflicts, source-version checks, manual fallback versus automation failure, consistent export snapshots, delegated actor identity, and notification delivery limits. Diagrams and snippets remained explanatory material, not evidence that their code executed.

Manual review also found that broad synthesis could reopen a threshold or edit-invalidation decision already supplied in the current request, overstate a transfer between domains, or include an optional module without sufficient qualification. A bounded draft revision, verified current-input quotes, and more focused generation instructions improve the boundary but do not guarantee correction. A focused Northbank answer passing automated signals is therefore not counted as semantically verified. Inspect current requirements and original passages before using a cross-case recommendation as an implementation specification.

The live reports and browser screenshots remain local under ignored output/playwright/. They include generated text and excerpts for inspection, not access credentials. Do not upload this verification record or presenter material as historical evidence.
