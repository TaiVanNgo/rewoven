import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  applyCaseSuggestion,
  editCaseDraft,
  emptyCaseDraft,
  fillCaseDraft,
  invalidateCaseDraft,
} from "../src/features/cases/case-draft";
import type { CaseSuggestions } from "../src/features/cases/case-suggestions";

const suggestions: CaseSuggestions = {
  title: { value: "Suggested title", evidence: [] },
  context: { value: "Suggested context", evidence: [] },
  outcome: { value: "", evidence: [] },
  lessons: { value: "Documented caveat", evidence: [] },
};
test("AI fills blank fields without replacing a contributor's existing text", () => {
  const draft = editCaseDraft(emptyCaseDraft(), "title", "My own title");
  const filled = fillCaseDraft(draft, suggestions);
  assert.equal(filled.fields.title, "My own title");
  assert.equal(filled.fields.context, "Suggested context");
  assert.equal(filled.fields.outcome, "");
  assert.equal(filled.applied.title, undefined);
  const accepted = applyCaseSuggestion(
    filled,
    "title",
    suggestions.title.value,
  );
  assert.equal(accepted.fields.title, "Suggested title");
  assert.equal(accepted.applied.title, "Suggested title");
});
test("replacing a source clears untouched AI text while preserving edited and manual fields", () => {
  let draft = fillCaseDraft(emptyCaseDraft(), suggestions);
  draft = editCaseDraft(draft, "context", "My reviewed architecture");
  draft = editCaseDraft(draft, "outcome", "Manually recorded outcome");
  draft = invalidateCaseDraft(draft);
  assert.equal(draft.fields.title, "");
  assert.equal(draft.fields.lessons, "");
  assert.equal(draft.fields.context, "My reviewed architecture");
  assert.equal(draft.fields.outcome, "Manually recorded outcome");
  assert.deepEqual(draft.applied, {});
});
test("re-reading never replaces an edited suggestion, even if text is changed back", () => {
  let draft = fillCaseDraft(emptyCaseDraft(), suggestions);
  draft = editCaseDraft(draft, "title", suggestions.title.value);
  const cleared = invalidateCaseDraft(draft);
  assert.equal(cleared.fields.title, suggestions.title.value);
  const filled = fillCaseDraft(draft, {
    ...suggestions,
    title: { value: "New AI title", evidence: [] },
  });
  assert.equal(filled.fields.title, suggestions.title.value);
});
