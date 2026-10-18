# Office Purchasing Pilot - Implementation notes

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Meadow Office Services (fictional)  
**Project:** Office Purchasing Pilot  
**Period:** January 2026  
**Status:** Delivered limited pilot  
**Document version:** 1

## Decision and rationale

Approval was bound to a request revision rather than a mutable request row. A transaction inserted the decision and changed state only when the submitted revision still matched the manager's screen. A stale manager screen received a conflict and had to reload. The design deliberately kept rejected and superseded revisions rather than overwriting their item lists.

## Technical behavior

The tables were purchase_request, request_revision, approval_decision, and request_event. Each revision kept a calculated total in integer VND. The server recalculated it from submitted line items rather than trusting a browser total. Request events identified the actor, revision, old state, new state, and server timestamp. The database transaction prevented a state update from succeeding without its corresponding decision record.

## Worked example

Request PO-014 asked for four chairs. A manager opened revision 2, then the requester increased the quantity to six, creating revision 3. Approving revision 2 returned a revision conflict. The manager reloaded and approved revision 3. The history showed both the amendment and the later approval, making it possible for the administrator to explain which list was authorized.

## Verification scope

Acceptance checks exercised manager approval, self-approval rejection, an edit after approval, and a stale manager screen. The approved request could not remain approved after its quantity changed. These were scripted functional checks using fictional employee accounts and a single office. No test exercised multiple branches or a second finance decision, because those behaviors had not been built.

## Handover material

The handover included the transition checklist, revision-conflict example, database relationship sketch, and acceptance notes. An engineer can use these records to understand the design, but this document pack contains no application source code or drop-in library. Any reuse still requires implementation, integration with current sign-in, and tests against the new client's approval rules.
