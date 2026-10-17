export const requestSamples = [
  {
    title: "Review delivery runs",
    summary: "Prepare routes with reviewed manifest revisions.",
    description:
      "Help dispatchers import delivery manifests, review route groups, and keep an audit trail of late stop amendments before exporting run sheets.",
    category: "Delivery planning",
    badgeVariant: "approval",
  },
  {
    title: "Prevent overbooked courses",
    summary: "Reserve seats safely under concurrent requests.",
    description:
      "Build course registration with time-limited seat reservations, safe confirmation retries, and capacity checks inside a database transaction.",
    category: "Registration",
    badgeVariant: "onboarding",
  },
  {
    title: "Search a document archive",
    summary: "Keep original sources separate from suggestions.",
    description:
      "Migrate a searchable catalog with versioned attachments, original checksums, and human review of proposed record changes. Treat imported notes as untrusted content.",
    category: "Document archive",
    badgeVariant: "knowledge",
  },
] as const;
