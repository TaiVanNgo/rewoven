import type { CaseOverview } from "./case-overview";
import {
  type CaseSuggestions,
  SUGGESTION_FIELDS,
  type SuggestionField,
} from "./case-suggestions";

export type CaseDraft = {
  overview?: CaseOverview;
  fields: Record<SuggestionField | "text", string>;
  applied: Partial<Record<SuggestionField, string>>;
};
export function emptyCaseDraft(): CaseDraft {
  return {
    fields: { title: "", context: "", outcome: "", lessons: "", text: "" },
    applied: {},
  };
}
export function editCaseDraft(
  draft: CaseDraft,
  field: keyof CaseDraft["fields"],
  value: string,
): CaseDraft {
  const applied = { ...draft.applied };
  if (field !== "text") delete applied[field];
  return { ...draft, fields: { ...draft.fields, [field]: value }, applied };
}
export function fillCaseDraft(
  draft: CaseDraft,
  suggestions: CaseSuggestions,
): CaseDraft {
  const fields = { ...draft.fields };
  const applied = { ...draft.applied };
  for (const field of SUGGESTION_FIELDS) {
    if (!fields[field].trim() && suggestions[field].value) {
      fields[field] = suggestions[field].value;
      applied[field] = suggestions[field].value;
    }
  }
  return {
    ...draft,
    fields,
    applied,
    ...(!draft.overview && suggestions.overview
      ? { overview: structuredClone(suggestions.overview) }
      : {}),
  };
}
export function applyCaseSuggestion(
  draft: CaseDraft,
  field: SuggestionField,
  value: string,
): CaseDraft {
  return {
    ...draft,
    fields: { ...draft.fields, [field]: value },
    applied: { ...draft.applied, [field]: value },
  };
}
export function invalidateCaseDraft(draft: CaseDraft): CaseDraft {
  const fields = { ...draft.fields };
  for (const field of SUGGESTION_FIELDS) {
    if (
      draft.applied[field] !== undefined &&
      fields[field] === draft.applied[field]
    )
      fields[field] = "";
  }
  return {
    ...draft,
    fields,
    applied: {},
    overview: draft.overview
      ? {
          ...draft.overview,
          sections: Object.fromEntries(
            Object.entries(draft.overview.sections).map(([key, findings]) => [
              key,
              findings.filter((f) => f.origin === "user"),
            ]),
          ) as CaseOverview["sections"],
        }
      : undefined,
  };
}
