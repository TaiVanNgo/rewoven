export const requestSamples = [
  {
    title: "Two-stage purchase approvals",
    summary: "Manager then finance, with decision history.",
    description:
      "Build a dashboard where purchase requests go through a manager and then finance, with a history of decisions.",
    category: "Approval flow",
    badgeClass: "bg-approval text-approval-ink",
  },
  {
    title: "Client onboarding checklist",
    summary: "A clear handoff for new clients.",
    description:
      "Structured step-by-step verification flow for new customer accounts with role assignment and status logging.",
    category: "Onboarding",
    badgeClass: "bg-lime-soft text-knowledge-ink",
  },
  {
    title: "Searchable support knowledge base",
    summary: "Find answers in past support work.",
    description:
      "Indexed internal documentation search with tag filters and versioned solution cards.",
    category: "Knowledge repo",
    badgeClass: "bg-knowledge text-knowledge-ink",
  },
] as const;
