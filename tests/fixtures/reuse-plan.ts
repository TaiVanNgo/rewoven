import type { ActionablePlan } from "../../src/features/plans/types";

// Mocked writing samples exercise formatting and persistence, not model quality.
export function registrationPlan(): ActionablePlan {
  return {
    formatVersion: 2,
    kind: "reuse",
    sections: [
      {
        heading: "Proposed outcome",
        items: [
          {
            kind: "recommendation",
            text: "For the confirmed request, build a registration workflow that reserves available seats and records confirmations for review.",
            evidence: [],
            doneWhen: "",
          },
          {
            kind: "recommendation",
            text: "Illustrative example: when two people request the last seat, confirm one reservation and explain to the other person that the seat is unavailable.",
            evidence: [],
            doneWhen: "",
          },
        ],
      },
      {
        heading: "What to reuse and change",
        items: [
          {
            kind: "recommendation",
            text: "Evaluate transaction-enforced seat reservations. The pilot recorded seat leases enforced by database transactions. For this request, adapt that approach to reserve a seat only while capacity remains.",
            evidence: ["e1"],
            doneWhen: "",
          },
          {
            kind: "inference",
            text: "The journal records a duplicate confirmation issue. For this request, test repeated submissions before treating confirmation as reliable; the recorded issue alone does not establish a working fix.",
            evidence: ["e1"],
            doneWhen: "",
          },
        ],
      },
      {
        heading: "Implementation steps",
        items: [
          {
            kind: "recommendation",
            text: "Agree on capacity and reservation duration before building the registration flow.",
            evidence: [],
            doneWhen:
              "The project lead has reviewed examples for the last available seat and an expired reservation.",
          },
          {
            kind: "recommendation",
            text: "Build a small flow from selecting a seat to confirmation, with a history of state changes.",
            evidence: [],
            doneWhen:
              "Two simultaneous requests for the last seat cannot both receive a confirmed reservation.",
          },
          {
            kind: "recommendation",
            text: "Test retries and expiry before reviewing the proposed rollout.",
            evidence: [],
            doneWhen:
              "Repeated submissions and expired reservations have documented outcomes that the project lead can review.",
          },
        ],
      },
      {
        heading: "Risks and limits",
        items: [
          {
            kind: "fact",
            text: "The journal does not record a final outcome for the pilot; it does not establish successful delivery.",
            evidence: ["e1"],
            doneWhen: "",
          },
        ],
      },
      {
        heading: "Decisions to confirm",
        items: [
          {
            kind: "unknown",
            text: "What capacity and reservation duration are required? These decisions determine when a seat is available and when it can be released.",
            evidence: [],
            doneWhen: "",
          },
        ],
      },
    ],
  };
}

export function northbankPlan(): ActionablePlan {
  return {
    formatVersion: 2,
    kind: "reuse",
    sections: [
      {
        heading: "Proposed outcome",
        items: [
          {
            kind: "recommendation",
            text: "The confirmed request asks for a four-week purchasing pilot for three branches using Next.js, PostgreSQL, existing employee sign-in and mobile browsers. Treat four weeks as a requested constraint, with feasibility still to be assessed. Exclude bank payments, automatic invoice posting, supplier onboarding, full offline synchronization and accounting integration.",
            evidence: [],
            doneWhen: "",
          },
          {
            kind: "recommendation",
            text: "Illustrative example: a request totalling exactly VND 10,000,000 including tax takes manager review, then finance review, as required by the confirmed request. Below that amount it takes manager review only. The requester cannot approve their own request, and the finance reviewer must differ from the approving manager. Editing a line item, quantity, price or tax restarts manager review for the new version.",
            evidence: [],
            doneWhen: "",
          },
        ],
      },
      {
        heading: "What to reuse and change",
        items: [
          {
            kind: "recommendation",
            text: "The purchasing pilot recorded approvals tied to the exact request version. For this request, adapt that pattern to both review stages so edits invalidate earlier approvals; it does not by itself prove the new two-stage flow works.",
            evidence: ["e1"],
            doneWhen: "",
          },
          {
            kind: "recommendation",
            text: "The reimbursement pilot recorded a stable submission key for retries. For this request, apply that pattern so retrying after a lost response returns the original request, while a changed payload under the same key is rejected.",
            evidence: ["e2"],
            doneWhen: "",
          },
        ],
      },
      {
        heading: "Implementation steps",
        items: [
          {
            kind: "recommendation",
            text: "Agree on the permission and review rules, then build submission through manager review. Enforce branch access on the server for every read and write; allow explicitly assigned central finance reviewers the required cross-branch access.",
            evidence: [],
            doneWhen:
              "Direct access to another branch is rejected for an unauthorized employee, and the requester cannot supply the manager decision.",
          },
          {
            kind: "recommendation",
            text: "Add finance review at or above the server-calculated tax-inclusive threshold and bind both decisions to one version.",
            evidence: [],
            doneWhen:
              "Tests below, at and above VND 10,000,000 follow the correct stages, the approving manager cannot provide the finance decision, and edits to line items, quantities, prices or tax invalidate approval and restart manager review.",
          },
          {
            kind: "recommendation",
            text: "Add safe retries and an exportable event history recording actor, server timestamp, action, revision and state changes.",
            evidence: [],
            doneWhen:
              "Lost-response and concurrent retries create one request, changed retry payloads are rejected, and exports state their authorized scope and time range.",
          },
          {
            kind: "recommendation",
            text: "Review the complete pilot before committing to delivery or rollout.",
            evidence: [],
            doneWhen:
              "The team has reviewed the integrated acceptance examples, remaining dependencies and a recovery procedure, and assessed the requested four-week window.",
          },
        ],
      },
      {
        heading: "Risks and limits",
        items: [
          {
            kind: "unknown",
            text: "The new combined flow still needs validation. No measured improvement in approval time is supplied, and an event history does not establish compliance or tamper resistance.",
            evidence: [],
            doneWhen: "",
          },
        ],
      },
      {
        heading: "Decisions to confirm",
        items: [
          {
            kind: "unknown",
            text: "Who maintains manager and finance assignments, and is delegation permitted? These answers determine assignment maintenance and delegated authority.",
            evidence: [],
            doneWhen: "",
          },
          {
            kind: "unknown",
            text: "How long must records and exports be retained? This determines retention and cleanup behavior.",
            evidence: [],
            doneWhen: "",
          },
          {
            kind: "unknown",
            text: "What peak number of simultaneous submissions should be supported? This determines the load-test target.",
            evidence: [],
            doneWhen: "",
          },
          {
            kind: "unknown",
            text: "What happens after rejection and resubmission? This determines the request states and staff feedback.",
            evidence: [],
            doneWhen: "",
          },
        ],
      },
    ],
  };
}
