# Northbank purchasing pilot - constraints

Fictional demonstration material. This is a new client request, not a historical project outcome.

## Delivery scope

Northbank Services asks Threadline Delivery to propose a four-week pilot for three branches. Use Next.js and PostgreSQL, the existing employee sign-in, and a mobile browser interface. These are requested constraints, not evidence that the four-week delivery is feasible. The team should identify sequencing, dependencies, and risks before committing to an estimate.

## Rules that must remain in the plan

- A manager reviews every submitted request. Finance reviews it afterwards when its tax-inclusive total is VND 10,000,000 or above; exactly VND 10,000,000 takes both stages.
- The requester cannot approve their own request. The finance reviewer must differ from the approving manager.
- A line-item, quantity, price, or tax edit invalidates existing approvals and restarts manager review for the new revision.
- Retrying the same submission after a lost response must not create another purchase request. A new intentional request is a different operation.
- Branch access must be enforced on the server. Explicitly assigned central finance reviewers may inspect and review across branches.
- Retain actor, server timestamp, action, revision, and state changes. Exports must state their authorized scope and time range.

## Explicit exclusions

No bank payments, automatic invoice posting, supplier-onboarding module, full offline synchronization, or accounting integration in this pilot. A purchase request is not proof of an order, delivery, or payment. This brief makes no compliance or tamper-proof claim.

## Questions to resolve with Northbank

Who maintains manager and finance assignments? Is delegation permitted, and for which actions? How long must records and exports be retained? What peak number of simultaneous submissions should be tested? Which rejection and resubmission behavior do staff expect? No measured approval-time improvement is supplied.
