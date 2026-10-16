import type { RequestDraft } from "@/features/requests/request-draft";
import type { Evidence, QueryAnswer, QueryFocus } from "./types";

export class QueryInputError extends Error {}
export function queryText(value: unknown, limit = 10000): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    throw new QueryInputError(
      `Enter text of 1–${limit.toLocaleString("en-US")} characters.`,
    );
  return value.trim();
}
export function requestInput(input: Record<string, unknown>): RequestDraft {
  const result: RequestDraft = {
    request: queryText(input.request),
    deadline: "",
    technology: "",
    capabilities: "",
  };
  for (const key of ["deadline", "technology", "capabilities"] as const) {
    const value = input[key] ?? "";
    if (typeof value !== "string" || value.length > 1000)
      throw new QueryInputError(
        "Each constraint must contain at most 1,000 characters.",
      );
    result[key] = value.trim();
  }
  return result;
}
export function focusInput(input: Record<string, unknown>): QueryFocus {
  const scope = input.scope ?? "library";
  const caseId = input.caseId ?? null;
  if (
    !["library", "case", "related"].includes(String(scope)) ||
    (caseId !== null &&
      (typeof caseId !== "string" ||
        !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(caseId))) ||
    (scope !== "library" && !caseId) ||
    (scope === "library" && caseId !== null)
  )
    throw new QueryInputError("Choose a case, or search all cases.");
  return {
    scope: scope as QueryFocus["scope"],
    caseId: caseId as string | null,
  };
}

export const answerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sections"],
  properties: {
    sections: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "heading", "text", "evidence"],
        properties: {
          kind: {
            type: "string",
            enum: ["fact", "inference", "recommendation", "unknown"],
          },
          heading: { type: "string", maxLength: 120 },
          text: { type: "string", maxLength: 2000 },
          evidence: { type: "array", maxItems: 6, items: { type: "string" } },
        },
      },
    },
  },
};

// Resolve only server-supplied evidence IDs. Schema validity alone cannot prove support.
export function validateAnswer(
  value: unknown,
  evidence: Evidence[],
): QueryAnswer {
  if (
    !value ||
    typeof value !== "object" ||
    !("sections" in value) ||
    !Array.isArray(value.sections) ||
    !value.sections.length ||
    value.sections.length > 12
  )
    throw new QueryInputError(
      "Wren returned an invalid answer. Retry this turn.",
    );
  const ids = new Set(evidence.map((item) => item.id));
  const sections = value.sections.map((section: unknown) => {
    if (!section || typeof section !== "object")
      throw new QueryInputError("Invalid answer section.");
    const item = section as Record<string, unknown>;
    if (
      !["fact", "inference", "recommendation", "unknown"].includes(
        String(item.kind),
      ) ||
      typeof item.heading !== "string" ||
      !item.heading.trim() ||
      item.heading.length > 120 ||
      typeof item.text !== "string" ||
      !item.text.trim() ||
      item.text.length > 2000 ||
      !Array.isArray(item.evidence) ||
      item.evidence.length > 6 ||
      item.evidence.some((id) => typeof id !== "string" || !ids.has(id)) ||
      (item.kind !== "unknown" && !item.evidence.length)
    )
      throw new QueryInputError(
        "Wren's answer contains missing or invalid evidence. Retry this turn.",
      );
    return {
      kind: item.kind,
      heading: item.heading.trim(),
      text: item.text.trim(),
      evidence: [...new Set(item.evidence)],
    } as QueryAnswer["sections"][number];
  });
  return { sections };
}
