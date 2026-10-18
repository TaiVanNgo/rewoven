# Expense Reimbursement Portal - Implementation notes

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Seabrook Advisory (fictional)  
**Project:** Expense Reimbursement Portal  
**Period:** February 2026  
**Status:** Delivered internal pilot after retry defect repair  
**Document version:** 1

## Decision and rationale

The stable operation key was scoped to the submitting employee. A unique database constraint on employee_id and operation_key serialized duplicate creation attempts. The server stored a normalized payload fingerprint with the claim. Reusing a key with a different payload returned a conflict instead of silently attaching changed receipt details to the first claim.

## Technical behavior

Claim creation ran inside a database transaction. A repeated matching operation loaded the existing claim and returned its identifier and current status. Concurrent requests competed on the unique constraint, so the loser read the winner's committed record. The client retained the key across a timeout and cleared it only after confirmation or an explicit decision to start a different submission.

## Worked example

Employee E-18 submitted claim EXP-042. The database committed, but a simulated network interruption hid the response. The browser retried with the same operation key and identical receipt details. The server returned EXP-042. A later attempt that changed the amount while keeping that key was rejected as a conflicting operation and required the user to review the form.

## Verification scope

Regression checks covered a response lost after commit, two simultaneous matching submissions, and the same key with a changed payload. In the controlled checks, matching retries returned one claim identifier and a changed payload produced a conflict. The checks used a synthetic network failure and test accounts. They did not establish reliability under real production traffic or indefinite retry retention.

## Handover material

The handover retained the lost-response reproduction, database constraint description, payload-conflict rule, and regression checklist. A future team can adapt the submission pattern to another record-creation workflow. It must choose the correct actor scope and key lifetime for that workflow, rather than copying an expense-specific assumption or claiming that payment safety has been proven.
