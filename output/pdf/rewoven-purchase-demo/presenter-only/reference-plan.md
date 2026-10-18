# Northbank purchasing pilot - presenter reference plan

**Human-written review reference. Do not upload this file to Rewoven.** This describes acceptable reasoning, not a required model response. All cases and client requirements are fictional.

## Confirmed request

Propose a four-week pilot for three Northbank branches using Next.js, PostgreSQL, existing sign-in, and a mobile browser. Every request takes manager review; a tax-inclusive total of exactly VND 10 million or more also takes finance review afterwards. The requester cannot approve their own request, and the approving manager cannot supply the finance decision. Changes to line items, quantities, prices, or tax invalidate prior approval and restart manager review. Safe retries, server-enforced branch access, and an exportable event history are required. The client brief establishes these requirements, not their feasibility or delivery.

## Relevant precedent and important differences

- **Office Purchasing Pilot:** The delivered one-office workflow approved a specific revision. Its implementation notes describe stale-revision rejection; delivery review page 1 confirms that finance review was not delivered. Northbank's second stage and cross-branch roles require new work.
- **Expense Reimbursement Portal:** Its implementation notes describe a stable actor-scoped operation key, a unique database constraint, and a changed-payload conflict. Delivery review page 1 limits the result to controlled retry checks. This can inform purchase submission; it does not prove payment safety or real-world reliability.
- **Branch Inventory Request Portal:** Its notes and delivery review page 1 support server checks against current assignments, including direct links. Purchasing and finance authority require their own permission matrix.
- **Audit Export Dashboard:** Its notes define actor, server timestamp, action, revision, scope, and cutoff. Delivery review page 2 disclaims compliance and privileged-administrator tamper resistance.
- **Invoice Matching Pilot:** Delivery review page 1 records failure and manual fallback. It supports a caution about unresolved exceptions and unsupported automation-success claims, not a working matching engine.

The Purchasing Expansion Proposal offers design questions, but its delivery review page 1 records no implementation or executed acceptance tests. Marketing Content Approval permits mutable editorial drafts; it is not an equivalent authorization flow. Supplier onboarding and leave delegation are useful discovery references, not mandatory Northbank pilot modules.

## What to reuse

Adapt the revision-bound state transitions and stale-screen checks, stable-key retry pattern, branch authorization matrix, event-field checklist, and bounded export pattern. These are documented design patterns and tests. The pack contains no finished source code or drop-in component.

## Required adaptations

Implement manager-then-finance routing against the tax-inclusive server-calculated total. Bind both decisions to one revision and enforce distinct actors. Restart review after the specified edits. Resolve branch and finance assignments on the server for every read, write, and export; do not rely on browser filters. Handle identical retries by returning the recorded request and reject a changed payload under the same operation key. Record state changes and their events atomically where the new implementation requires it. Each adaptation needs validation against Northbank's rules.

## Lessons and risks

Do not mistake a paused design for delivered capability, an accepted narrow pilot for multi-branch success, or completed manual fallback for successful automation. Do not promise a reduction in approval time: none is measured. A browser event log is not proof of compliance. Treat four weeks as the requested planning constraint, with an estimate dependent on discovery and integration.

## Clarification questions

Who owns manager/finance assignments and role changes? Is delegation allowed? What is the retention period? What peak concurrency should be tested? What happens after rejection and resubmission? Who can export and which fields are sensitive? Keep supplier onboarding, accounting integration, payments, and full offline synchronization outside the pilot unless scope is explicitly changed.

## Suggested next steps

1. Meet the assignment and finance-policy owners; agree the permission matrix, rejection behavior, and acceptance examples.
2. Build a vertical slice from draft through server-validated submission and manager review, with revision history and safe retry.
3. Add finance routing and distinct-actor checks; then branch permissions and scoped event export. Validate the stages together before expanding rollout.
4. Test below, at, and above VND 10 million; edits after either approval; stale screens; self-approval; the same manager acting as finance; concurrent/lost-response retries; changed retry payloads; cross-branch direct access; expired assignments; and export boundaries.
5. Review the pilot with fictional acceptance records first. Agree a limited rollout and a manual recovery procedure. Measure actual approval time only after defining a baseline and measurement scope.

The order above is a proposed plan informed by historical evidence. It is not evidence that this new work has shipped, nor a commitment that all work fits the requested four weeks.
