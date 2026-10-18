# Purchasing Expansion Proposal - Implementation notes

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Meadow Office Services (fictional)  
**Project:** Purchasing Expansion Proposal  
**Period:** June 2026  
**Status:** Proposal only; not implemented  
**Document version:** 1

## Decision and rationale

The design discussion favored a versioned approval-policy definition rather than a hard-coded finance flag. A proposed decision record would identify policy version, stage, actor, and request revision. The note explains a possible approach and alternatives; none of the proposed tables or endpoints was implemented under this project. The original pilot's delivered behavior was not changed.

## Technical behavior

Open design items included whether the threshold used a tax-inclusive total, whether a manager could also serve as finance reviewer, who maintained assignments, and how a policy change affected in-flight requests. The proposal suggested resolving these questions before implementing transition logic. There was no signed-off policy and no completed concurrency or authorization test to cite.

## Worked example

A workshop used a fictional request near an undecided threshold to discuss routing. Participants disagreed on whether a later amount edit should restart manager review or only finance review. The sketch proposed restarting both stages for a changed revision, but the workshop did not close the policy decision. The example was a design exercise rather than an executed application workflow.

## Verification scope

The proposal listed future checks for threshold boundaries, edits after manager approval, missing finance assignments, and concurrent decisions. No checks were executed for this expansion. A list of intended tests must not be presented as passing results. The team retained the list so another discovery effort could evaluate it against that client's actual policy.

## Handover material

The retained material consists of workshop questions, a design sketch, and an explicit paused status. A future project can use the questions to structure discovery, but should cite delivered work separately and validate the new design. No source code, finished multi-stage approval component, or measured benefit is provided by this proposal.
