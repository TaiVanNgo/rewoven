import { test } from "bun:test";
import assert from "node:assert/strict";
import { validateSuggestions } from "../src/features/cases/case-suggestions";

const pages = [
  {
    number: 3,
    text: "Expense approval portal.\n Managers approve expenses.\nNo rollout results recorded.",
  },
];
function suggestion() {
  return {
    title: {
      value: "Expense approval portal",
      evidence: [{ page: 3, quote: "Expense approval portal." }],
    },
    context: {
      value: "Managers approve expenses.",
      evidence: [{ page: 3, quote: "Managers approve expenses." }],
    },
    outcome: { value: "", evidence: [] },
    lessons: { value: "", evidence: [] },
  };
}
test("accepts page-grounded suggestions and preserves unknown outcomes as empty", () => {
  const result = validateSuggestions(suggestion(), pages, true);
  assert.equal(result.title.evidence[0].page, 3);
  assert.equal(result.outcome.value, "");
});
test("rejects invented quotes, wrong pages, uncited values, and oversized output", () => {
  const invented = suggestion();
  invented.context.evidence[0].quote = "Approval time fell 90%.";
  assert.throws(
    () => validateSuggestions(invented, pages, true),
    /could not be verified/,
  );
  const wrongPage = suggestion();
  wrongPage.title.evidence[0].page = 1;
  assert.throws(
    () => validateSuggestions(wrongPage, pages, true),
    /could not be verified/,
  );
  const uncited = suggestion();
  uncited.outcome.value = "Successful launch";
  assert.throws(
    () => validateSuggestions(uncited, pages, true),
    /without matching evidence/,
  );
  const oversized = suggestion();
  oversized.title.value = "a".repeat(201);
  assert.throws(() => validateSuggestions(oversized, pages, true), /oversized/);
  assert.throws(() =>
    validateSuggestions({ title: "wrong type" }, pages, true),
  );
});
test("matches extraction whitespace and requires null page references for plain text", () => {
  const input = suggestion();
  input.context.evidence[0].quote = "portal. Managers approve";
  validateSuggestions(input, pages, true);
  input.context.evidence[0].quote = "  ";
  assert.throws(
    () => validateSuggestions(input, pages, true),
    /quote is empty/,
  );
  const plain = {
    ...suggestion(),
    title: {
      value: "Expense portal",
      evidence: [{ page: null, quote: "Expense approval portal." }],
    },
    context: { value: "", evidence: [] },
  };
  validateSuggestions(plain, pages, false);
  assert.throws(
    () => validateSuggestions(suggestion(), pages, false),
    /PDF page number for a text source/,
  );
});

test("reports the field and exact malformed reference without disclosing source text", () => {
  const source = [{ number: 1, text: "a".repeat(601) }];
  const input = {
    title: {
      value: "Example",
      evidence: [{ page: 1, quote: "a".repeat(600) }],
    },
    context: { value: "", evidence: [] },
    outcome: { value: "", evidence: [] },
    lessons: { value: "", evidence: [] },
  };
  validateSuggestions(input, source, true);
  input.title.evidence[0].quote += "a";
  assert.throws(
    () => validateSuggestions(input, source, true),
    /AI title reference 1 quote is 601 characters; the maximum is 600/,
  );
  for (const page of [null, "1"]) {
    const malformed = {
      ...input,
      title: { value: "Example", evidence: [{ page, quote: "actual quote" }] },
    };
    assert.throws(
      () => validateSuggestions(malformed, source, true),
      /AI title reference 1 needs a PDF page number/,
    );
  }
  input.title.evidence[0].quote = " ";
  assert.throws(
    () => validateSuggestions(input, source, true),
    /AI title reference 1 quote is empty/,
  );
});

test("a paraphrased third context quote reproduces the reported failure; exact source text passes", () => {
  const input = suggestion();
  input.context.evidence = [
    { page: 3, quote: "Expense approval portal." },
    { page: 3, quote: "Managers approve expenses." },
    { page: 3, quote: "No results recorded." },
  ];
  assert.throws(
    () => validateSuggestions(input, pages, true),
    /AI context reference 3 quote could not be verified on its source page/,
  );
  input.context.evidence[2].quote = "No rollout results recorded.";
  validateSuggestions(input, pages, true);
});
