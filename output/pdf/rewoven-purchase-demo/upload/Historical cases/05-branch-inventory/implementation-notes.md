# Branch Inventory Request Portal - Implementation notes

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Hillcrest Distribution (fictional)  
**Project:** Branch Inventory Request Portal  
**Period:** March 2026  
**Status:** Delivered branch-scoped pilot  
**Document version:** 1

## Decision and rationale

Authorization was enforced in server-side record queries and writes, not only in the list screen. The server resolved branch membership from the signed-in employee and checked the target record's stored branch. A central review capability was separate from a branch requester's assignment. This prevented a user from changing a URL or request body to obtain a different branch's records.

## Technical behavior

The data model used employee_assignment, branch, inventory_request, and review_event. An assignment had a role and active flag. The application checked assignments on each operation rather than storing a permanent branch entitlement in a browser form. A request retained its original branch identity after creation; changing the employee's current assignment did not silently move historical requests between branches.

## Worked example

A North Branch requester copied the URL of a South Branch request. The server returned access denied rather than relying on the North Branch list filter. A central reviewer with an explicit active assignment could read both records. When the North requester lost that assignment, subsequent edits were denied even if a browser tab had been left open.

## Verification scope

Controlled checks covered direct-link access, a forged branch identifier, cross-branch editing, an inactive assignment, and an explicitly authorized central reviewer. The tested requester could not read or modify another branch's request. The checks used two fictional branches and test identities; they did not establish organization-wide identity governance or validate integration with a real directory.

## Handover material

The handover included an authorization matrix, endpoint checks, and examples of denied direct access. These are patterns and test cases rather than a complete identity integration. A future project must decide who assigns branch managers and finance reviewers, how assignments expire, and whether central staff may approve or only inspect records.
