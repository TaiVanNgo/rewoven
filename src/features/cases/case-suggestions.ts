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

export const MAX_EVIDENCE_QUOTES = 3;
export const MAX_QUOTE_CHARS = 600;
export const SUGGESTED_FIELD_LIMITS = {
  title: 200,
  context: 2000,
  outcome: 2000,
  lessons: 2000,
} as const;

export function createSuggestionsSchema(pages: SourcePage[], isPdf: boolean) {
  // PDF extraction retains every page, including empty ones, in physical order.
  const pageSchema = isPdf
    ? {
        type: "integer",
        minimum: pages[0].number,
        maximum: pages[pages.length - 1].number,
      }
    : { type: "null" };
  return {
    type: "object",
    additionalProperties: false,
    required: [...SUGGESTION_FIELDS],
    properties: Object.fromEntries(
      SUGGESTION_FIELDS.map((field) => [
        field,
        {
          type: "object",
          additionalProperties: false,
          required: ["value", "evidence"],
          properties: {
            value: { type: "string", maxLength: SUGGESTED_FIELD_LIMITS[field] },
            evidence: {
              type: "array",
              maxItems: MAX_EVIDENCE_QUOTES,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["page", "quote"],
                properties: {
                  page: pageSchema,
                  quote: {
                    type: "string",
                    minLength: 1,
                    maxLength: MAX_QUOTE_CHARS,
                    pattern: "\\S",
                  },
                },
              },
            },
          },
        },
      ]),
    ),
  };
}

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
      field.value.length > SUGGESTED_FIELD_LIMITS[key] ||
      !Array.isArray(field.evidence) ||
      field.evidence.length > MAX_EVIDENCE_QUOTES
    )
      throw new SuggestionError(
        "AI returned invalid or oversized fields. Try again or enter the details manually.",
      );
    const text = field.value.trim();
    const evidence = field.evidence.map((entry: unknown, index: number) => {
      const item = object(entry);
      const label = `AI ${key} reference ${index + 1}`;
      const recovery = "Try again or enter the details manually.";
      if (isPdf && !Number.isInteger(item.page))
        throw new SuggestionError(
          `${label} needs a PDF page number. ${recovery}`,
        );
      if (!isPdf && item.page !== null)
        throw new SuggestionError(
          `${label} includes a PDF page number for a text source. ${recovery}`,
        );
      if (typeof item.quote !== "string")
        throw new SuggestionError(
          `${label} is missing its source quote. ${recovery}`,
        );
      if (item.quote.length > MAX_QUOTE_CHARS)
        throw new SuggestionError(
          `${label} quote is ${item.quote.length} characters; the maximum is ${MAX_QUOTE_CHARS}. ${recovery}`,
        );
      if (!normalized(item.quote))
        throw new SuggestionError(`${label} quote is empty. ${recovery}`);
      const page = isPdf
        ? pages.find((page) => page.number === item.page)
        : pages[0];
      if (!page || !normalized(page.text).includes(normalized(item.quote)))
        throw new SuggestionError(
          `${label} quote could not be verified on its source page. ${recovery}`,
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
