# Threadline Delivery: turn past work into a new plan

All material is fictional. Threadline Delivery is one software delivery company; the nine cases are projects it delivered or proposed for different fictional clients. Northbank Services is a new client. The full history is not one application, and the new request is not a tenth historical case.

## What the audience should understand

Northbank needs purchasing across branches. No previous project solves everything. Office Purchasing supplies revision-bound manager review; Expense Reimbursement supplies safe retries; Branch Inventory supplies server authorization; Audit Export supplies explainable history. Invoice Matching supplies a caution about unresolved exceptions and fallback claims. Supplier Onboarding is optional discovery material. Leave and Marketing are partial matches with different authority. Purchasing Expansion is a proposal, not a finished component.

## Prepare before the five-minute presentation

Follow docs/features/purchasing-demo.md in the repository. Seed the nine projects, index all 27 source documents, and use a fresh demo session. Choose Use demo library. Do not attach individual cases: discovering useful cases across the nine-project collection is part of the story. Keep this presenter folder out of uploads. A hosted installation must be seeded and indexed separately from local development.

If demonstrating manual case creation, upload the three documents from ONE Historical cases folder as ONE case. Repeat for other projects only in a separate rehearsal session. Never upload the ZIP directly, the answer key, or client input to Case library. The built-in cases already contain all 27 originals.

## Five-minute narrative (processing time varies)

1. First 30 seconds: explain the company and Northbank's problem. Point out that the history includes delivered work, a failed pilot, and an unimplemented proposal.
2. Next 60 seconds: choose Use demo library and upload client-brief.pdf plus constraints.md from Client input into chat. Send: Which previous projects help with this request? Explain what we can reuse, what changes, and what is still unknown.
3. Next 60 seconds: ask: What can we learn from our past projects about preventing duplicate submissions when a connection drops after Send? Then inspect sources for the purchasing revision rule and reimbursement retry defect. A broad first answer may select only some useful projects; a targeted follow-up demonstrates further discovery. Show the PDF page and original text. Explain why a different project's lesson can transfer without making the two products identical.
4. Next 45 seconds: ask: Why isn't the marketing approval workflow enough, and was the purchasing expansion actually implemented? Expect qualified comparison with original sources, not a refusal to mention partial matches.
5. Remaining time: choose Draft reuse plan, review Northbank's requirements, generate, and inspect the draft. Edit one next step to add a meeting with the finance-assignment owner, Save, reload if time permits, and Export Markdown.

Rehearse first. Live reading and model latency may exceed these allocations; do not promise a five-minute runtime. A prepared chat can support a presentation, but say when a result was prepared earlier.

## Optional uncertainty and failure prompts

- What evidence shows this will reduce approval time? Expected: no measured improvement is established.
- Can we reuse a finished two-stage purchasing component from the expansion? Expected: no implementation was recorded; discuss its design questions separately.
- Did completing the invoice cycle prove the matching automation worked? Expected: no; manual fallback completed the cycle after the pilot stopped.
- What precedent do these cases provide for quantum gate error correction? Expected: no suitable precedent, not an invented connection.

## Reference plan: a review rubric, not an exact answer

A useful plan keeps the VND 10 million inclusive threshold, manager-then-finance ordering, separate actors, approval invalidation, safe retry, branch checks, and scoped event export. It proposes state/permission design, then a small vertical slice, then threshold/revision/retry/authorization/export tests and pilot review. It cites the historical sources behind reused patterns and client sources behind new requirements.

Historical facts, possible adaptations, and questions must remain distinct. A four-week request is not a proven estimate. Do not turn the proposal into delivered work, a staging test into production reliability, a manual fallback into automation success, or an application log into a compliance guarantee. Supplier onboarding and delegation remain questions, not silently added requirements.

## Sharing with judges through Google Drive

Upload Historical cases, Client input, and this separately labelled Presenter guide to a folder you own. Share a view/download link after checking access in a signed-out browser. Judges need only the two Client input files to try the preloaded demo. The historical folders let them inspect sources or recreate cases. Do not upload server environment files, private exports, sessions, or credentials. Google Drive is a distribution folder; Rewoven does not connect to it.

The upload-only ZIP contains the 29 inputs and no presenter answers. The complete pack ZIP contains a separately labelled presenter-only folder. Judge outputs may differ; use evidence-map.json to inspect support, not to demand identical phrasing.
