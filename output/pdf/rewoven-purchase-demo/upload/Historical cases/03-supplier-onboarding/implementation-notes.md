# Supplier Onboarding Workspace - Implementation notes

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Birch Supply Cooperative (fictional)  
**Project:** Supplier Onboarding Workspace  
**Period:** February 2026  
**Status:** Delivered checklist workflow  
**Document version:** 1

## Decision and rationale

Document presence and supplier acceptance were stored as separate states. A required_document row described the item and checklist version, while document_check recorded reviewer, timestamp, source version, and result. The accept transition required completed checks for the active checklist. Upload success alone never set the supplier to accepted.

## Technical behavior

The directory exposed a supplier identifier, display name, review state, and review version. Downstream tools were expected to look up the identifier rather than compare display names. Replacing a contact name did not create a new supplier identity. No interface in this pilot guaranteed that a directory entry was valid for a particular purchase amount or branch.

## Worked example

Supplier SUP-031 had a readable contact form but was missing one required attachment. Its record stayed in collecting documents. After the attachment arrived, a reviewer completed the remaining check and the administrator accepted the directory entry. A later replacement of that attachment reopened its check instead of inheriting the old review automatically.

## Verification scope

Functional checks covered missing required items, acceptance with a completed checklist, document replacement, and an unassigned reviewer attempting a write. Acceptance was blocked until the required checks were complete. The checks used invented supplier records and local test files. They did not assess whether document contents were truthful or whether the supplier was commercially suitable.

## Handover material

The reusable material is a checklist definition, source-version review rule, and explicit state transition table. A future project must ask which supplier checks are required and who owns them. If a new brief says only purchasing, it should not silently grow supplier onboarding into the first release without confirming that requirement with the client.
