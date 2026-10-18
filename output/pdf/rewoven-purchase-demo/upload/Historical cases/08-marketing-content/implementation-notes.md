# Marketing Content Approval Tool - Implementation notes

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Paperplane Media (fictional)  
**Project:** Marketing Content Approval Tool  
**Period:** May 2026  
**Status:** Delivered editorial review workflow  
**Document version:** 1

## Decision and rationale

The client chose editable drafts and lightweight review markers. A notification linked to the current draft, and the editor checked final text before scheduling. The team explicitly declined a revision-locked sign-off because that was not the agreed editorial workflow. This choice was suitable for the stated pilot but was never validated for authorization of money or goods.

## Technical behavior

The model held content_draft, comment, review_marker, and notification. Notifications identified the work item and reason without including a complete draft in email. The current draft remained mutable; review_marker did not contain a complete approved text snapshot. Reviewer assignment was editorial and did not encode financial separation of duties or a purchase amount.

## Worked example

An author submitted a campaign headline, received a wording comment, and changed the copy while review was still open. The reviewer marked the draft reviewed, and the editor later adjusted punctuation before scheduling publication. The tool retained the activity, but it did not ask for another review after that final edit under the client's agreed workflow.

## Verification scope

The pilot checks covered comment creation, a review-queue notification, access for assigned editors, and a scheduled item appearing in the editor's list. The team did not run tests for immutable approved amounts, duplicate purchase submission, two-stage financial review, or finance identity. Those guarantees cannot be inferred from successful editorial tests.

## Handover material

The team retained notification copy, review-queue states, and the discussion explaining mutable drafts. These are useful records of an editorial product. A new team should inspect them to understand both possible reuse and mismatch, instead of selecting this implementation solely because its title contains the word approval.
