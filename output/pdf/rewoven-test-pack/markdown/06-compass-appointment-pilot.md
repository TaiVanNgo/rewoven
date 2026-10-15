# Compass Appointment Reminder Pilot

Fictional source document | Compass Community Clinic Office | Status: Measured administrative pilot

All names, events, dates, and measurements are synthetic test data. This file contains no real personal or production information.

## 01. Project brief and evidence boundary

This is a fictional internal record from Compass Community Clinic Office. It describes Compass Appointment Reminder Pilot in the area of appointment administration. Every organization, event, participant, and number is invented for software testing. The record combines a project brief, decision notes, operational scenarios, and a handover appendix. It should be read as one bounded source rather than as an independent verification of the organization's performance.

Booking staff manually called people with upcoming administrative appointments and could not reliably tell whether a reminder was sent, declined, or awaiting a callback. The experiment concerns office scheduling only and contains no clinical records or medical guidance.

The main working role is the booking clerk. The unit of work is a reminder task; the record follows its creation, review, correction, and eventual disposition. This vocabulary matters because a record can be created successfully while the larger business activity remains incomplete. A review screen, an exported file, a replayed test, and a production result describe different kinds of evidence. Later sections state which kind is actually available.

The source's status is: Measured administrative pilot. The intended audience includes the working team and the next maintainer who needs to understand a decision without reconstructing it from chat. The document records uncertainty alongside implementation detail. The final metrics section is the place to check actual observations; statements of purpose, acceptance criteria, and future plans elsewhere do not establish that those observations happened.

- Administrative test data only
- Two office desks for a three-week pilot
- No clinical information or decisions
- Language preference may change after queue creation

## 02. Existing workflow and the problem in practice

A typical working day begins when the booking clerk receives an incomplete description of the next reminder task. The description may be technically readable but still require a decision about identity, timing, or units. The team therefore distinguished syntactic validity from business validity: being able to import a row does not mean that the row should be approved. That distinction prevents a clean-looking screen from hiding an unresolved operational question.

- Step 1: Import an appointment reference list.
- Step 2: Check contact consent and language preference.
- Step 3: Queue a reminder task.
- Step 4: Record a delivery receipt or failed attempt.
- Step 5: Offer a staff-managed callback.
- Step 6: Reconcile the queue without changing appointment attendance.

The existing problem was not simply a missing database. A reminder task could be discussed in one place, changed in another, and checked later by someone who did not see the original request. The proposed record of work makes these transitions visible. It also gives the booking clerk a place to leave a correction rationale instead of passing an unexplained number to the next person.

An illustrative exception is a late correction after review has begun. The first version remains part of the audit trail, while the corrected version requires its own review. The walkthrough is explanatory; it does not assert that a measured incident occurred. When this record describes an actual fictional observation, it uses the explicit incident or measurement sections rather than relying on this illustrative workflow.

## 03. Scope, exclusions, and acceptance conditions

The scope centers on reminder tasks and their review history. The team deliberately avoided assigning the new component ownership of every upstream and downstream system. A useful result at this boundary is a traceable decision with a clear status, an identifiable input version, and enough context for a person to explain why the decision was made. Broader organizational effects require separate measurements.

- Administrative test data only
- Two office desks for a three-week pilot
- No clinical information or decisions
- Language preference may change after queue creation

Acceptance conditions were written as checks that an observer could repeat. A reviewer should be able to locate the original reminder task, inspect a corrected version without losing the first one, and distinguish a pending state from a completed state. A rejected operation should explain what information is missing. These are proposed or scoped conditions; their presence in the plan does not mean that every one passed in deployment.

The following omissions remain intentional or unresolved: Attendance effects are unknown. The pilot does not establish results for additional offices. Messaging costs were not evaluated. A future team can investigate them, but should not fill the gaps with estimates presented as facts. The source does not establish the staffing, spending, or delivery schedule of future work. A later implementation should preserve the distinction between a requirement that was discussed and an observation that was actually recorded.

## 04. Architecture and record ownership

A browser queue is backed by a small API and PostgreSQL. A background scheduler prepares reminder tasks, while a gateway adapter records delivery receipts from a fictional messaging sandbox. Appointment scheduling remains in an existing office system; the reminder service does not amend it.

| Record                | Important fields                                  | Rule                                       |
| --------------------- | ------------------------------------------------- | ------------------------------------------ |
| Appointment reference | Opaque reference, slot, office code               | No diagnosis or clinical note is collected |
| Contact preference    | Reference, consent state, language                | Opt-out is checked before every attempt    |
| Reminder task         | Reference, scheduled time, attempt state          | An attempt is not proof of attendance      |
| Delivery receipt      | Provider reference, reported state, received time | Receipt semantics are documented           |
| Callback request      | Reference, requested window, assigned clerk       | Staff controls the actual callback         |
| Daily reconciliation  | Queued count, attempted count, unresolved count   | Counts retain their definitions            |

The ownership boundary is more important than the technology label. The component that accepts a reminder task owns the validation and status history for that record; it does not automatically become the source of truth for a downstream business result. A maintainer should be able to identify both the original evidence and the decision made from it. Private working material is retained only within the intended test scenario.

A schema migration should preserve old identifiers and the meaning of earlier statuses. Replaying an earlier input against newer code can be useful for diagnosis, but the replay is a new observation with its own conditions. It must not silently rewrite the recorded history of the original attempt. The fictional record therefore keeps input identity, processing state, and human review as separate concepts.

## 05. Decision log and rejected alternatives

| Decision                          | Recorded rationale                                                            |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Consent before every attempt      | A preference change must cancel an already queued reminder.                   |
| Separate delivery from attendance | A delivered reminder says nothing about whether the person attends.           |
| Opaque references                 | The pilot does not need clinical information.                                 |
| Clerk-owned callbacks             | A callback request is routed to people rather than automatically rescheduled. |

The first alternative considered was allowing the booking clerk to overwrite the latest record without keeping prior values. It was easy to describe, but would have made it difficult to explain which version a colleague had reviewed. The decision notes favor a visible correction path instead. The choice adds a review step, yet preserves the evidence required to diagnose disagreements later.

The second alternative was treating every successful technical operation as business completion. For example, receiving a response or producing an export says that one step finished; it does not prove that all reminder tasks reached their intended business destination. The team documented this distinction so that progress updates would not grow into unsupported success claims.

A later team may choose a different implementation if its constraints change. The useful part of this log is the reasoning: A preference change must cancel an already queued reminder. The pilot does not need clinical information. Those statements explain why the original boundary existed. A replacement should either preserve the same assurance or explicitly record why a different tradeoff is acceptable.

## 06. Working chronology and review notes

These fictional working dates organize the team's discussion of appointment administration. They are not deployment receipts. Several activities can occur while a project is still proposed or limited to a controlled environment. Read a date next to its evidence classification rather than assuming that chronological progress implies a launch.

| Date       | Working note                                                                                                                                                                        | Evidence classification |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 2026-07-03 | Working session examined: import an appointment reference list. The note records the question and its required evidence; it does not certify a live release.                        | Design or review note   |
| 2026-07-06 | Working session examined: check contact consent and language preference. The note records the question and its required evidence; it does not certify a live release.               | Design or review note   |
| 2026-07-09 | Working session examined: queue a reminder task. The note records the question and its required evidence; it does not certify a live release.                                       | Design or review note   |
| 2026-07-12 | Working session examined: record a delivery receipt or failed attempt. The note records the question and its required evidence; it does not certify a live release.                 | Design or review note   |
| 2026-07-15 | Working session examined: offer a staff-managed callback. The note records the question and its required evidence; it does not certify a live release.                              | Design or review note   |
| 2026-07-18 | Working session examined: reconcile the queue without changing appointment attendance. The note records the question and its required evidence; it does not certify a live release. | Design or review note   |

The review format asked three questions at each transition: what input was available, what decision was made, and what remained unknown? For reminder tasks, that prevented missing source material from being concealed by a status update. A note saying that the team examined a scenario only establishes the examination; an observed test result needs an explicit environment and expected behavior.

Meeting notes were kept short enough for the booking clerk to revisit. Where two notes disagree, the disagreement remains part of the source. A later summary must not select the more optimistic statement merely because it appears later in the file. Closure depends on the evidence and its scope, not on the position of a paragraph.

## 07. Detailed walkthrough of one unit of work

### Scenario 1: Import an appointment reference list

In this illustrative scenario, the booking clerk works with the appointment reference record while handling a reminder task. The visible information includes opaque reference, slot, office code. The governing rule is: No diagnosis or clinical note is collected. If required evidence is absent, the person leaves the operation pending and records the missing condition. This scenario describes intended handling, not a separately measured success rate.

### Scenario 2: Check contact consent and language preference

In this illustrative scenario, the booking clerk works with the contact preference record while handling a reminder task. The visible information includes reference, consent state, language. The governing rule is: Opt-out is checked before every attempt. If required evidence is absent, the person leaves the operation pending and records the missing condition. This scenario describes intended handling, not a separately measured success rate.

### Scenario 3: Queue a reminder task

In this illustrative scenario, the booking clerk works with the reminder task record while handling a reminder task. The visible information includes reference, scheduled time, attempt state. The governing rule is: An attempt is not proof of attendance. If required evidence is absent, the person leaves the operation pending and records the missing condition. This scenario describes intended handling, not a separately measured success rate.

### Scenario 4: Record a delivery receipt or failed attempt

In this illustrative scenario, the booking clerk works with the delivery receipt record while handling a reminder task. The visible information includes provider reference, reported state, received time. The governing rule is: Receipt semantics are documented. If required evidence is absent, the person leaves the operation pending and records the missing condition. This scenario describes intended handling, not a separately measured success rate.

### Scenario 5: Offer a staff-managed callback

In this illustrative scenario, the booking clerk works with the callback request record while handling a reminder task. The visible information includes reference, requested window, assigned clerk. The governing rule is: Staff controls the actual callback. If required evidence is absent, the person leaves the operation pending and records the missing condition. This scenario describes intended handling, not a separately measured success rate.

### Scenario 6: Reconcile the queue without changing appointment attendance

In this illustrative scenario, the booking clerk works with the daily reconciliation record while handling a reminder task. The visible information includes queued count, attempted count, unresolved count. The governing rule is: Counts retain their definitions. If required evidence is absent, the person leaves the operation pending and records the missing condition. This scenario describes intended handling, not a separately measured success rate.

## 08. Incident, exception, and recovery record

An opt-out arrived between task creation and dispatch in the sandbox. The initial worker checked consent only when preparing the queue. The team cancelled the pending task, moved the check immediately before dispatch, and added a replay case. The source records a sandbox defect and its observed retest; it does not claim an audit of every external provider.

The immediate response separates the current operational question from a permanent fix. The booking clerk needs to know which reminder tasks are affected, which original inputs remain available, and whether continuing would make reconciliation harder. A workaround can restore a narrow workflow while leaving the underlying design question open. That limited restoration should not be reported as proof that the whole component is reliable.

The follow-up record should name the scenario, identify its input version, and state the boundary of any retest. An entry that passes once is a useful observation but does not certify every source format, every operating condition, or every future change. Where this fictional archive has no such result, its absence remains visible rather than being filled by a generalized claim.

## 09. Observed results, targets, and uncertainty

Across the three-week office pilot, clerks spent a median 18 minutes per day reconciling the reminder queue, compared with a 31-minute baseline from the prior ten working days. In a separate 120-task sandbox replay, all seven opted-out references were suppressed. Appointment attendance and no-show changes were not measured.

| Measure                    | Starting point or scope | Recorded value              | Interpretation limit                  |
| -------------------------- | ----------------------- | --------------------------- | ------------------------------------- |
| Daily reconciliation time  | 31 minutes median       | 18 minutes median           | Different observation windows         |
| Opt-outs suppressed        | 120-task replay         | 7 of 7 opted-out references | Sandbox check, not all future traffic |
| Attendance or no-show rate | Not measured            | Not measured                | No outcome claim permitted            |

Interpretation must preserve the environment and denominator attached to a result. A count of reminder tasks in a rehearsal cannot be presented as the number completed in production. A time comparison does not establish a separate quality improvement. If an earlier section describes a goal, that goal remains a goal until this section contains a compatible observation with clear scope.

The unresolved items are: Attendance effects are unknown. The pilot does not establish results for additional offices. Messaging costs were not evaluated. None of these gaps is resolved by the amount of technical detail in the architecture section. A reader can understand a design well while still being unable to establish its operational outcome. If a summary needs to be shorter, keep the uncertainty rather than removing it to make the project sound complete.

## 10. Documented lessons and reusable boundaries

- Recheck changing preferences immediately before dispatch.
- Treat gateway receipts as delivery evidence, never attendance evidence.
- Use opaque references when the workflow does not need sensitive content.

The reusable part is the relationship between a reminder task, its original evidence, and the review decision. Copying an implementation without that relationship could reproduce the interface while losing the reason that the team could trust a particular status. A future maintainer should ask whether the same identity rules, review authority, and correction history still apply in the new setting.

Reuse also needs a boundary statement. A delivered reminder says nothing about whether the person attends. That rationale is tied to this project's constraints; it is not a universal rule that replaces investigation. Before adapting the design, compare the new inputs, downstream authority, failure recovery requirements, and evidence needed to claim completion. Differences should be recorded as open decisions rather than hidden inside a copied configuration.

The lessons listed here were explicitly recorded in this fictional source. They are not claims that every recommendation was implemented successfully. In particular, a lesson drawn from a rehearsal or rollback can be valuable even if the project has no positive production outcome. Keep the lesson's origin visible when summarizing it for another team.

## 11. Handover, access, and operational questions

A person taking over appointment administration work should first locate the current status of each reminder task and the original material supporting that status. The handover should distinguish ordinary operation, pending review, and an exception that needs a named decision. Access to a review screen does not grant authority to change a downstream system or certify the final business result.

- Find the original appointment reference input before changing a derived field.
- Check the reminder task identity and the effective version used by the review.
- Ask the booking clerk to explain the normal correction path.
- Record the evidence scope when handing an issue to another person.
- Preserve a pending state when the required approval or source is absent.
- Treat environment access and data retention as separate questions from project success.

The archive intentionally does not include credentials, personal production records, or an executable deployment procedure. Environment names in this report identify fictional evidence contexts. They should not be converted into real infrastructure settings. A reader testing a document-processing application can use the text to check whether uncertainty survives summarization without trying to operate the fictional service.

Open handover questions remain concrete: who can authorize a correction, which record version is being reviewed, and what event proves that the next boundary accepted it? Attendance effects are unknown. The pilot does not establish results for additional offices. Those missing answers matter more than a confident closing paragraph. They remain explicit so another reader can decide what evidence to collect next.

## 12. Evidence index and final source notes

| Source marker | What this report actually contains                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 06-BRIEF      | Booking staff manually called people with upcoming administrative appointments and could not reliably tell whether a reminder was sent, declined, or awaiting a callback. The experiment concerns office scheduling only and contains no clinical records or medical guidance.                                                                                         |
| 06-ARCH       | A browser queue is backed by a small API and PostgreSQL. A background scheduler prepares reminder tasks, while a gateway adapter records delivery receipts from a fictional messaging sandbox. Appointment scheduling remains in an existing office system; the reminder service does not amend it.                                                                    |
| 06-INCIDENT   | An opt-out arrived between task creation and dispatch in the sandbox. The initial worker checked consent only when preparing the queue. The team cancelled the pending task, moved the check immediately before dispatch, and added a replay case. The source records a sandbox defect and its observed retest; it does not claim an audit of every external provider. |
| 06-RESULT     | Across the three-week office pilot, clerks spent a median 18 minutes per day reconciling the reminder queue, compared with a 31-minute baseline from the prior ten working days. In a separate 120-task sandbox replay, all seven opted-out references were suppressed. Appointment attendance and no-show changes were not measured.                                  |
| 06-GAPS       | Attendance effects are unknown. The pilot does not establish results for additional offices. Messaging costs were not evaluated.                                                                                                                                                                                                                                       |

This index helps a reviewer locate the source of a statement; it is not an additional outcome. The brief describes the problem, the architecture describes component responsibilities, and the incident record describes an exception with its evidence boundary. The results entry is the only consolidated statement of the fictional observations. All quotations should refer to the words actually present in this version of the report.

A future amendment should keep the old record available and say which claim it corrects. For Compass Community Clinic Office, that means a new note cannot silently replace the scope of the reminder tasks already described here. If later evidence resolves an unknown, the new evidence needs its own date and source. No such later amendment is included in this file.

End of the fictional source record. Current status: Measured administrative pilot. The report ends with the same boundary it began with: a technical description is useful evidence about the design, while an operational result must be grounded in an explicit observation. Any stronger conclusion requires additional source material.
