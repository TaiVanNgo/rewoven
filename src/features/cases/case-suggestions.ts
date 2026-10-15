import type { SourcePage } from "./types";

export const SUGGESTION_FIELDS = [
  "title",
  "context",
  "outcome",
  "lessons",
] as const;
export type SuggestionField = (typeof SUGGESTION_FIELDS)[number];
export type SuggestedValue = {
  value: string;
  evidence: { page: number | null; quote: string }[];
};
export type CaseSuggestions = Record<SuggestionField, SuggestedValue>;
export type CaseAnalysis = {
  id: string;
  model: string;
  promptVersion: number;
  suggestions: CaseSuggestions;
  warnings: string[];
  pageCount: number;
  isPdf: boolean;
};
export type CaseAIReview = CaseAnalysis & {
  sourceId: string;
  createdAt: string;
};

const valueSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "evidence"],
  properties: {
    value: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["page", "quote"],
        properties: {
          page: { type: ["integer", "null"] },
          quote: { type: "string" },
        },
      },
    },
  },
};
export const suggestionsSchema = {
  type: "object",
  additionalProperties: false,
  required: [...SUGGESTION_FIELDS],
  properties: Object.fromEntries(
    SUGGESTION_FIELDS.map((key) => [key, valueSchema]),
  ),
};

export class SuggestionError extends Error {}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SuggestionError(
      "AI returned invalid fields. Try again or enter the details manually.",
    );
  return value as Record<string, unknown>;
}
const normalized = (text: string) => text.replace(/\s+/gu, " ").trim();

// JSON shape alone is insufficient: every nonempty field must cite real source text.
export function validateSuggestions(
  value: unknown,
  pages: SourcePage[],
  isPdf: boolean,
): CaseSuggestions {
  const input = object(value);
  const result = {} as CaseSuggestions;
  for (const key of SUGGESTION_FIELDS) {
    const field = object(input[key]);
    if (
      typeof field.value !== "string" ||
      field.value.length > (key === "title" ? 200 : 2000) ||
      !Array.isArray(field.evidence) ||
      field.evidence.length > 3
    )
      throw new SuggestionError(
        "AI returned invalid or oversized fields. Try again or enter the details manually.",
      );
    const text = field.value.trim();
    const evidence = field.evidence.map((entry: unknown) => {
      const item = object(entry);
      if (
        (isPdf ? !Number.isInteger(item.page) : item.page !== null) ||
        typeof item.quote !== "string" ||
        item.quote.length > 600 ||
        !normalized(item.quote)
      )
        throw new SuggestionError(
          "AI returned invalid source references. Try again or enter the details manually.",
        );
      const page = isPdf
        ? pages.find((page) => page.number === item.page)
        : pages[0];
      if (!page || !normalized(page.text).includes(normalized(item.quote)))
        throw new SuggestionError(
          "AI cited text that could not be verified in the source. Try again or enter the details manually.",
        );
      return { page: isPdf ? page.number : null, quote: item.quote.trim() };
    });
    if ((text && !evidence.length) || (!text && evidence.length))
      throw new SuggestionError(
        "AI returned a field without matching evidence. Try again or enter the details manually.",
      );
    result[key] = { value: text, evidence };
  }
  return result;
}
