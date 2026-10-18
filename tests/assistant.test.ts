import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  assistantPlanInput,
  chatContextInput,
  evidenceBudget,
} from "../src/features/queries/assistant";
import type { Evidence } from "../src/features/queries/types";
import { validateAnswer } from "../src/features/queries/validation";

const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
test("chat selection validates mode, five-case bound, duplicates and identifiers", () => {
  assert.deepEqual(chatContextInput({ mode: "selected", caseIds: [a, b] }), {
    mode: "selected",
    caseIds: [a, b],
  });
  for (const value of [
    null,
    { mode: "library", caseIds: [a] },
    { mode: "samples", caseIds: [a] },
    { mode: "selected", caseIds: [] },
    { mode: "selected", caseIds: [a, a] },
    { mode: "selected", caseIds: ["foreign"] },
    { mode: "selected", caseIds: Array(6).fill(a) },
  ])
    assert.throws(() => chatContextInput(value));
});
test("demo collection is an explicit empty-ID scope, separate from private uploads", () => {
  assert.deepEqual(chatContextInput({ mode: "samples", caseIds: [] }), {
    mode: "samples",
    caseIds: [],
  });
});
test("case identifiers are canonicalized before duplicate checks", () => {
  const lower = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  assert.deepEqual(
    chatContextInput({ mode: "selected", caseIds: [lower.toUpperCase()] })
      .caseIds,
    [lower],
  );
  assert.throws(() =>
    chatContextInput({
      mode: "selected",
      caseIds: [lower, lower.toUpperCase()],
    }),
  );
});
test("assistant plans reject forged case references and unbounded searches", () => {
  const plan = {
    intent: "search",
    queries: ["risks"],
    caseIds: [a],
    reply: "",
  };
  assert.equal(assistantPlanInput(plan, [a]).intent, "search");
  assert.throws(() => assistantPlanInput({ ...plan, caseIds: [b] }, [a]));
  assert.throws(() =>
    assistantPlanInput({ ...plan, queries: ["1", "2", "3"] }, [a]),
  );
  assert.throws(() =>
    assistantPlanInput({ ...plan, intent: "conversation" }, [a]),
  );
});
test("conversational blocks can be uncited but project advice still requires evidence", () => {
  const section = {
    kind: "conversation",
    heading: "",
    text: "Hi! What would you like to explore?",
    evidence: [],
  };
  assert.equal(
    validateAnswer({ sections: [section] }, [], true).sections[0].kind,
    "conversation",
  );
  assert.throws(() => validateAnswer({ sections: [section] }, []));
  for (const kind of ["fact", "inference", "recommendation"])
    assert.throws(() =>
      validateAnswer({ sections: [{ ...section, kind }] }, [], true),
    );
  assert.throws(() =>
    validateAnswer(
      { sections: [{ ...section, kind: "fact", evidence: ["fake"] }] },
      [],
      true,
    ),
  );
});
test("evidence budgeting interleaves cases, deduplicates chunks, and preserves originals", () => {
  const passage = (
    id: string,
    caseId: string,
    text = "original",
  ): Evidence => ({
    id: "",
    chunk_id: id,
    source_id: id,
    case_id: caseId,
    title: "case",
    source_title: "source",
    version: 1,
    page_number: 1,
    char_start: 0,
    char_end: text.length,
    text,
    outcome: "",
    score: 1,
  });
  const items = [
    passage("a1", a),
    passage("a2", a),
    passage("a3", a),
    passage("b1", b),
    passage("a1", a),
  ];
  const result = evidenceBudget(items, 3, 100);
  assert.deepEqual(
    result.map((e) => e.chunk_id),
    ["a1", "b1", "a2"],
  );
  assert.deepEqual(
    result.map((e) => e.id),
    ["e1", "e2", "e3"],
  );
  assert.equal(evidenceBudget(items, 30, 8).length, 1);
  assert.equal(result[0].text, "original");
});
