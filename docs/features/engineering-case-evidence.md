# Deeper case evidence and technical replies

The nine Threadline histories now explain how their fictional systems worked, rather than only stating a lesson. Each project still has three originals: a brief, implementation notes, and a two-page delivery review. The implementation notes contain component diagrams, data relationships, state transitions, sample API contracts, SQL or TypeScript pseudocode, worked traces, failure handling, operations, and primary technical references.

These are realistic fictional engineering records. The snippets and diagrams are explanatory reconstructions, not nine runnable applications or independently executed production tests. The Invoice Matching pilot still failed. Its replacement design remains proposed. The Purchasing Expansion remains an unimplemented proposal, including its schema, routes, and hypothetical results. External references explain technical patterns; they do not prove Threadline delivered anything.

## Walk through a concrete example

Open a **new chat** and ask:

> For the Expense Reimbursement Portal, show the architecture and explain what happens when a claim commits but the response is lost. Include a sequence diagram, an illustrative unique constraint, and the changed-payload conflict. Cite the sources.

The richer evidence explains that a logical submission keeps one employee-scoped operation key. A matching retry returns the existing claim; a changed payload under that key produces a conflict. It describes PostgreSQL `ON CONFLICT DO NOTHING` and a subsequent read under Read Committed, rather than catching a uniqueness exception inside an already-aborted transaction. It also distinguishes this pattern from intentional duplicate receipts and from payment execution.

Wren retrieves selected passages before generating its answer. Open each citation to check the mechanism. A valid reference proves that a passage was supplied, not that every generated claim follows from it. If a detail was not retrieved, ask a narrower follow-up. The app does not fetch the linked external documentation while answering.

Other useful prompts:

- “How does Office Purchasing handle an approval racing with an amendment? Show the transaction boundary.”
- “Why does Audit Export need a consistent snapshot as well as a cutoff? What about a transaction that commits late?”
- “Why does a Marketing Content review marker fail Northbank's purchasing requirements?”
- “Which Purchasing Expansion details are proposals, and which checks were actually executed?”

## How the files and data flow fit together

`scripts/demo/purchase-projects.json` owns the existing project narrative and curated overview quotes. The nine Markdown files in `scripts/demo/engineering/` own the detailed engineering reconstructions. Edit those authored files, not just a generated output: the next pack rebuild replaces generated originals.

`scripts/demo/build-pack.py` combines both sources into `output/pdf/rewoven-purchase-demo/`, regenerates review PDFs and the checksum manifest in `supabase/fixtures/cases.json`, and creates deterministic ZIP entries. The current client input files retain their existing requirements. Historical originals use document version 2 in their visible labels; source records start at database version 1 because each new original gets a new identity.

`scripts/sample-catalog.ts` uses namespace `rewoven-threadline-v2` plus a deterministic manifest content digest. Editing an original creates a new catalog identity, avoiding extra Ready sources on an already published three-source case. The importer stages nine new case records, originals, and chunks, validates them, then activates the complete catalog together. The old catalog is retired from discovery, not deleted. Saved answers and original downloads can still reference old source IDs. An interrupted import can resume; an unchanged repeat preserves new source/chunk identities and existing embeddings. The three-original activation guard needs no schema change.

After seeding, embedding backfill indexes the active originals. Retrieval still uses passages of at most 2,000 characters and a final evidence budget of 30 passages or 60,000 characters. Complete authored diagrams fit inside a passage. More source material creates more opportunities for relevant evidence, but does not mean Wren reads every document on every turn. Saved answers are not regenerated automatically.

The server assistant prompt requests concrete mechanisms and evidence-backed examples for technical questions. The planner can retain short verbatim current-request rules; the server accepts only quotes actually present in current typed input or request-document excerpts. Historical gaps cannot become confirmed client requirements through this path. Historical originals contain no Northbank-specific thresholds or rules. The answer interface still stores `kind`, `heading`, `text`, and evidence IDs. Provider schemas require references for fact, inference, and recommendation sections, including diagrams; the server also rejects technical fences disguised as uncited unknown/conversation sections. Existing per-section and citation limits remain in force. Model-generated snippets remain illustrations unless the source explicitly establishes their execution.

The evidence-review stage can explicitly report no supporting material. The server then saves a scoped unknown answer about the current search, rather than generating unsupported project claims from generic keyword overlap. This is still an AI relevance judgment, not a proof that the whole archive lacks evidence. The forward migration `202610190001_assistant_keyword_lexemes.sql` also fixes keyword fallback: English-normalized lexemes are parsed with the simple dictionary so they are not stemmed twice. Authorization, rank fusion, and passage limits remain the same.

For a new-project turn with retained current-rule quotes, Wren makes one additional model request to review its draft against the current question and original evidence. Only the revised answer is validated and saved. This bounded review adds latency and billable model usage; it does not prove entailment or guarantee every supplied rule remains correctly interpreted. Broad synthesis still needs human review, particularly attribution of delivered versus proposed work and whether an open question was already answered in the current request.

## Code blocks and diagrams in chat

`answer-text.tsx` preserves the older prose renderer for replies without backticks and uses restricted Markdown for technical replies. Code blocks show a language label and **Copy code**. Citation buttons remain application-controlled and appear outside code. User text stays plain text. No code executes, and model-written links, images, and HTML cannot become active content in technical replies.

`technical-code.tsx` owns the code block and copy interaction. `mermaid-diagram.tsx` loads Mermaid and DOMPurify only when a diagram is mounted. Rendering is serialized because Mermaid configuration is global. The app allows static flowcharts, sequence diagrams, state diagrams, and entity relationships, with application-owned strict configuration. It rejects source configuration, HTML, interaction directives, and external URLs. Complete presentation-only style/class lines are discarded before preview; inline directives remain unsupported. Sanitized SVG displays in an inert image context, with readable original source and labels in an expandable disclosure. Invalid diagrams retain their source instead of breaking the reply. Wide diagrams scroll within the bubble so mobile labels are not shrunk to fit the page.

These are Client Components because copying, theme changes, and diagram rendering need browser APIs. Database authorization, retrieval, and model requests remain on the server. Diagrams use a local browser library; the app does not send diagram source to an external rendering service. Light/dark changes regenerate the diagram. Wide code and diagram source scroll inside their containers, including by keyboard.

## Rebuild and run locally

Use the README's Node.js and Bun versions. Configure local Supabase credentials and an OpenAI key in ignored `.env.local`. Keep hosted credentials separate. Python 3 with `reportlab` is needed only to rebuild the document pack; it is not an application runtime dependency.

```bash
bun install --frozen-lockfile
python3 scripts/demo/build-pack.py
bun run format
bun run db:start
bun run db:migrate
bun run db:seed
# Billable: indexes active originals and active session uploads missing embeddings.
bun run db:backfill --embed
bun run dev
```

Open the URL printed by Next.js and start a new chat. Ctrl+C stops Next.js. `bun run db:stop` stops local Supabase while preserving records. Do not use `devrs` to upgrade the archive: that resets local data. A production-mode local check requires `bun run build` followed by `bun run start --port 3001`; the build creates the compiled application that `start` serves.

This change is activated locally only. No hosted deployment, production seeding, or hosted embedding backfill is part of this update.

## Verification and limitations

```bash
bun test tests/engineering-catalog.test.ts tests/sample-catalog.test.ts tests/answer-text.test.ts
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run build
# Local Supabase and an app server are required:
bun run test:integration
# Billable, local-only, actual Wren planner/retrieval/answer pipeline:
bun run test:wren:live
```

The live evaluator creates and deletes its own session, asks one technical question per case plus cross-case, mismatch, and unsupported questions, and writes `output/playwright/wren-engineering-live.json` (ignored by Git). Automated signals check cited-case membership, explanation terms, active catalog boundaries, and Ready turns. They do not prove sentence-level entailment. Inspect the saved answers and original excerpts manually. The older `test:retrieval:live` evaluates the separate standalone retrieval path and should not be presented as the sole verification of Wren's chat.

To rerun one failed scenario without repeating the entire billable rehearsal, use `bun run test:wren:live '--only=Northbank cross-case design'`. Focused runs have separate report filenames. Checks also flag missing requested diagrams, raw evidence IDs in prose, and certain already-supplied rules being reopened; these signals do not replace human review.

For the browser regression, first generate the live report, start the app, then run `TEST_BASE_URL=http://localhost:3001 python3 tests/technical-replies.browser.py`. Python needs Playwright installed in your development environment. The script defaults to an installed Google Chrome; set `PLAYWRIGHT_CHANNEL=chromium` after installing Playwright's Chromium if preferred. It uses an intercepted saved-answer fixture and real local source downloads, without making additional model calls. Browser dependencies are not added to the app runtime.

Unit tests check complete diagram retrieval, original provenance, v1/v2 identity boundaries, restricted Markdown, inert code, and citation placement. Integration tests cover repeated/interrupted catalog publication and retained v1 originals. Browser checks cover actual code copying, all four supported diagram types, malformed/hostile diagram fallback, themes, mobile width, citations, and reload. Recorded run results live in the pack's presenter-only verification file; do not upload that file as historical evidence.
