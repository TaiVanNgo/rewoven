import { emptyOverview, OVERVIEW_KEYS } from "../case-overview";
import "server-only";
import {
  MAX_EVIDENCE_QUOTES,
  MAX_QUOTE_CHARS,
  SUGGESTION_FIELDS,
  SuggestionError,
  validateSuggestions,
} from "../case-suggestions";
import type { SourcePage } from "../types";

export type SourceExcerpt = {
  id: number;
  page: number | null;
  quote: string;
};

// Keep all readable text in source order; excerpts never cross physical PDF pages.
export function createSourceExcerpts(pages: SourcePage[], isPdf: boolean) {
  const excerpts: SourceExcerpt[] = [];
  for (const page of pages) {
    for (let start = 0; start < page.text.length;) {
      let end = Math.min(start + MAX_QUOTE_CHARS, page.text.length);
      if (end < page.text.length) {
        const candidate = page.text.slice(start, end);
        const boundary = candidate.search(/\s+\S*$/u);
        if (boundary >= MAX_QUOTE_CHARS / 2) end = start + boundary;
        // Do not split a UTF-16 surrogate pair when bounding an unbroken token.
        else if (/[\uD800-\uDBFF]/u.test(page.text[end - 1])) end--;
      }
      const quote = page.text.slice(start, end).trim();
      if (quote)
        excerpts.push({
          id: excerpts.length + 1,
          page: isPdf ? page.number : null,
          quote,
        });
      start = end;
    }
  }
  return excerpts;
}

// The model selects IDs. Only the server supplies the quotes and page numbers.
export function resolveSourceReferences(
  value: unknown,
  excerpts: SourceExcerpt[],
  pages: SourcePage[],
  isPdf: boolean,
) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return validateSuggestions(value, pages, isPdf);
  const input = value as Record<string, unknown>;
  const resolved: Record<string, unknown> = {};
  for (const key of SUGGESTION_FIELDS) {
    const field = input[key];
    if (!field || typeof field !== "object" || Array.isArray(field))
      throw new SuggestionError(
        "AI returned invalid fields. Try again or enter the details manually.",
      );
    const { value: text, evidence } = field as Record<string, unknown>;
    if (!Array.isArray(evidence) || evidence.length > MAX_EVIDENCE_QUOTES)
      throw new SuggestionError(
        "AI returned invalid evidence. Try again or enter the details manually.",
      );
    resolved[key] = {
      value: text,
      evidence: evidence.map((id: unknown, index: number) => {
        const excerpt =
          typeof id === "number" && Number.isInteger(id)
            ? excerpts[id - 1]
            : undefined;
        if (!excerpt || excerpt.id !== id)
          throw new SuggestionError(
            `AI ${key} reference ${index + 1} does not identify a supplied source excerpt. Try again or enter the details manually.`,
          );
        return { page: excerpt.page, quote: excerpt.quote };
      }),
    };
  }
  const result = validateSuggestions(resolved, pages, isPdf);
  if (input.overview !== undefined)
    result.overview = resolveOverview(input.overview, excerpts, pages, isPdf);
  enforceClassification(result);
  return result;
}

// A large reading should retain independently verified fields when another field is malformed.
export function resolveSectionReferences(
  value: unknown,
  excerpts: SourceExcerpt[],
  pages: SourcePage[],
  isPdf: boolean,
  warnings: string[],
) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return resolveSourceReferences(value, excerpts, pages, isPdf);
  const input = value as Record<string, unknown>;
  const result = {} as ReturnType<typeof resolveSourceReferences>;
  for (const field of SUGGESTION_FIELDS) {
    const empty = Object.fromEntries(
      SUGGESTION_FIELDS.map((name) => [name, { value: "", evidence: [] }]),
    );
    let candidate = input[field];
    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate)
    ) {
      const item = candidate as Record<string, unknown>;
      // No factual claim remains when the value is blank; discard dangling citation IDs.
      if (typeof item.value === "string" && !item.value.trim())
        candidate = { value: "", evidence: [] };
    }
    try {
      result[field] = resolveSourceReferences(
        { ...empty, [field]: candidate },
        excerpts,
        pages,
        isPdf,
      )[field];
    } catch (error) {
      if (!(error instanceof SuggestionError)) throw error;
      result[field] = { value: "", evidence: [] };
      warnings.push(
        `A ${field} suggestion was left blank because its evidence could not be verified. Review the original documents or retry the reading before supplying that field.`,
      );
    }
  }
  if (input.overview !== undefined)
    result.overview = resolveOverview(input.overview, excerpts, pages, isPdf);
  enforceClassification(result);
  return result;
}

function enforceClassification(result: ReturnType<typeof validateSuggestions>) {
  if (
    result.overview?.classification === "non_project" &&
    SUGGESTION_FIELDS.some((key) => result[key].value)
  )
    throw new SuggestionError(
      "Non-project material cannot contain project suggestions.",
    );
}
function resolveOverview(
  value: unknown,
  excerpts: SourceExcerpt[],
  pages: SourcePage[],
  isPdf: boolean,
) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SuggestionError("AI returned an invalid project overview.");
  const raw = value as Record<string, unknown>;
  if (
    !["project", "non_project", "unclear"].includes(String(raw.classification))
  )
    throw new SuggestionError("AI returned an invalid project classification.");
  const overview = emptyOverview();
  overview.provenance = "ai";
  overview.classification =
    raw.classification as typeof overview.classification;
  for (const key of OVERVIEW_KEYS) {
    const entries = raw[key];
    if (!Array.isArray(entries) || entries.length > 4)
      throw new SuggestionError("AI returned an oversized overview section.");
    overview.sections[key] = entries.map((entry, index) => {
      if (
        !entry ||
        typeof entry.text !== "string" ||
        !entry.text.trim() ||
        entry.text.length > 600
      )
        throw new SuggestionError("AI returned an invalid overview finding.");
      const empty = Object.fromEntries(
        SUGGESTION_FIELDS.map((field) => [field, { value: "", evidence: [] }]),
      );
      const resolved = resolveSourceReferences(
        { ...empty, context: { value: entry.text, evidence: entry.evidence } },
        excerpts,
        pages,
        isPdf,
      );
      return {
        id: `${key}-${index + 1}`,
        text: entry.text.trim(),
        origin: "source" as const,
        evidence: resolved.context.evidence,
      };
    });
  }
  if (
    overview.classification === "non_project" &&
    OVERVIEW_KEYS.some((key) => overview.sections[key].length)
  )
    throw new SuggestionError(
      "Non-project material cannot contain project findings.",
    );
  return overview;
}
