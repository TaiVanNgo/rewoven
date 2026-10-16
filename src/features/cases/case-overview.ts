import type { SuggestedValue } from "./case-suggestions";

export const OVERVIEW_SECTIONS = {
  summary: "Case at a glance",
  problem: "Problem and constraints",
  approach: "Approach and key decisions",
  results: "Recorded results",
  lessons: "Lessons and reusable material",
  gaps: "Gaps and conflicting evidence",
} as const;
export type OverviewSection = keyof typeof OVERVIEW_SECTIONS;
export type OverviewEvidence = SuggestedValue["evidence"][number] & {
  sourceVersion?: number;
};
export type OverviewFinding = {
  id: string;
  text: string;
  origin: "source" | "user";
  evidence: OverviewEvidence[];
};
export type CaseOverview = {
  schemaVersion: 1;
  classification: "project" | "non_project" | "unclear";
  provenance: "ai" | "manual" | "curated";
  sources: { id: string; version: number }[];
  sections: Record<OverviewSection, OverviewFinding[]>;
};
export const OVERVIEW_KEYS = Object.keys(
  OVERVIEW_SECTIONS,
) as OverviewSection[];
export function emptyOverview(): CaseOverview {
  return {
    schemaVersion: 1,
    classification: "unclear",
    provenance: "manual",
    sources: [],
    sections: {
      summary: [],
      problem: [],
      approach: [],
      results: [],
      lessons: [],
      gaps: [],
    },
  };
}
export function overviewProjection(overview: CaseOverview) {
  const text = (key: OverviewSection) =>
    overview.sections[key].map((f) => f.text).join("\n\n");
  return {
    context: [text("summary"), text("problem"), text("approach")]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 5000),
    outcome: text("results").slice(0, 5000),
    lessons: text("lessons").slice(0, 5000),
  };
}
export function overviewStale(
  overview: CaseOverview,
  sources: { id: string; version: number }[],
) {
  return (
    overview.sources.length !== sources.length ||
    sources.some(
      (s) =>
        !overview.sources.some(
          (old) => old.id === s.id && old.version === s.version,
        ),
    )
  );
}
export function overviewSchema(excerptCount: number) {
  const section = {
    type: "array",
    maxItems: 4,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["text", "evidence"],
      properties: {
        text: { type: "string", maxLength: 600 },
        evidence: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: { type: "integer", minimum: 1, maximum: excerptCount },
        },
      },
    },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["classification", ...OVERVIEW_KEYS],
    properties: {
      classification: {
        type: "string",
        enum: ["project", "non_project", "unclear"],
      },
      ...Object.fromEntries(OVERVIEW_KEYS.map((key) => [key, section])),
    },
  };
}

// Submitted references are never trusted. Unchanged findings reuse their saved
// evidence; edited/new findings become contributor text without AI citations.
export function reviewOverview(
  input: unknown,
  original: CaseOverview | null,
): CaseOverview {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("A structured overview is required.");
  const candidate = input as CaseOverview;
  if (
    candidate.schemaVersion !== 1 ||
    !["project", "non_project", "unclear"].includes(candidate.classification) ||
    !candidate.sections
  )
    throw new Error("Invalid overview version or classification.");
  const result = emptyOverview();
  result.classification = candidate.classification;
  result.provenance = original?.provenance ?? "manual";
  result.sources = original?.sources ?? [];
  const ids = new Set<string>();
  for (const key of OVERVIEW_KEYS) {
    const findings = candidate.sections[key];
    if (!Array.isArray(findings) || findings.length > 4)
      throw new Error("Each overview section supports up to four findings.");
    result.sections[key] = findings.map((finding) => {
      if (
        !finding ||
        typeof finding !== "object" ||
        typeof finding.id !== "string" ||
        !finding.id.trim() ||
        finding.id.length > 100 ||
        ids.has(finding.id) ||
        typeof finding.text !== "string" ||
        !finding.text.trim() ||
        finding.text.length > 600
      )
        throw new Error(
          "Findings need unique IDs and 1–600 characters of text.",
        );
      ids.add(finding.id);
      const old =
        finding.origin === "source"
          ? original?.sections[key].find(
              (f) =>
                f.origin === "source" &&
                f.id === finding.id &&
                f.text === finding.text.trim(),
            )
          : undefined;
      return old
        ? structuredClone(old)
        : {
            id: finding.id,
            text: finding.text.trim(),
            origin: "user",
            evidence: [],
          };
    });
  }
  if (
    result.classification === "non_project" &&
    OVERVIEW_KEYS.some((key) => result.sections[key].length)
  )
    throw new Error("Non-project material cannot contain project findings.");
  return result;
}
