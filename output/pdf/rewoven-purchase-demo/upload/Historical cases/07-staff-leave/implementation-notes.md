# Staff Leave Approval Tool - Implementation notes

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Lark Studio (fictional)  
**Project:** Staff Leave Approval Tool  
**Period:** April 2026  
**Status:** Delivered manager delegation pilot  
**Document version:** 1

## Decision and rationale

A delegation was an explicit record with principal manager, delegate, allowed action, start, and expiry. The server evaluated it when approving, rather than caching a permanent delegate flag in the browser. Approval history recorded the actual actor and the principal. A delegate could not create another delegation to an additional person.

## Technical behavior

The request stored its assigned manager. A decision referenced either that manager acting directly or a valid delegation record. The UI displayed acting for only when a decision actually used delegation. After expiry, old decisions remained visible as history, but new writes required another current assignment. This separated historical explanation from current authority.

## Worked example

Manager M-03 delegated leave review to colleague D-02 for an agreed week. D-02 approved a leave request during that window, and the history retained both identities. A request sent after expiry could still be read by an otherwise authorized user, but D-02's attempted approval was denied unless a new delegation had been registered.

## Verification scope

Controlled checks covered an active delegation, expiry before approval, a forged manager identifier, and an attempt to delegate onward. The correct acting and represented identities appeared in accepted decisions. The tests did not include financial limits, branch purchasing authority, or an automated organization-directory integration, and they did not measure employee scheduling outcomes.

## Handover material

The handover included an assignment example, expiry tests, and actor-display rules. A future client should first decide whether delegation is allowed and whether the delegate may perform the same action or only review it. The existence of this project is a reason to ask that question, not a reason to add delegation silently to another project's first release.
