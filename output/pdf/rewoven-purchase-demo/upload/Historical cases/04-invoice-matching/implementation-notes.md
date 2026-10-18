# Invoice Matching Pilot - Implementation notes

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Copperline Retail (fictional)  
**Project:** Invoice Matching Pilot  
**Period:** March 2026  
**Status:** Failed pilot; manual fallback retained  
**Document version:** 1

## Decision and rationale

After reviewing the defects, the team required stable supplier identifiers, explicit purchase revisions, and a reason for every accepted exception. A batch could not advance while unresolved reconciliation items remained. These were corrective design decisions for a possible future iteration; they were not implemented and validated as a successful replacement pilot during this project.

## Technical behavior

The trial retained imported invoice rows, suggested purchase IDs, review decisions, and reconciliation exceptions. The rollback did not delete these records. An exception recorded the unmatched invoice, conflicting candidate references, reason, and reviewer note. The manual process used the original invoice and purchase material rather than trusting a suggestion simply because it had a populated match field.

## Worked example

An invoice from a supplier's trading name resembled two directory names. The prototype chose the first candidate and attached a purchase with a reused reference. Review found that the invoice covered a different delivery. The match was withdrawn, the item remained unresolved, and the operator used the original documents in the manual reconciliation process.

## Verification scope

The trial review deliberately included ambiguous supplier names, reused references, partial deliveries, and missing purchase records. Review found unresolved errors in the suggested matches. The team stopped the pilot before external posting. The notes do not record a repaired algorithm passing the same trial, so the review cannot be cited as proof of automated matching accuracy.

## Handover material

The retained material includes the exception examples, stop decision, manual fallback checklist, and proposed corrections. These documents can inform a release gate or a reconciliation discussion. They do not provide a validated matching engine. Any new project should keep approval and downstream posting separate instead of inferring that an approved request has already been ordered, received, or paid.
