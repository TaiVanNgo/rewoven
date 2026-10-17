import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  briefInput,
  clarificationPlan,
  exportMarkdown,
  generatedMarkdown,
  referencedSources,
  validateGenerated,
  validateMarkdown,
} from "../src/features/plans/content";
import type { ReusePlan } from "../src/features/plans/types";
import type { Evidence } from "../src/features/queries/types";

const evidence: Evidence[] = [
  {
    id: "e1",
    chunk_id: "00000000-0000-0000-0000-000000000001",
    source_id: "00000000-0000-0000-0000-000000000002",
    case_id: "00000000-0000-0000-0000-000000000003",
    title: "Past project",
    source_title: "retro.md",
    version: 1,
    page_number: 2,
    char_start: 0,
    char_end: 20,
    text: "A pilot required review.",
    outcome: "",
    score: 1,
  },
];
test("plan validation preserves missing intent and requires complete grounded sections", () => {
  assert.equal(
    briefInput(
      {
        title: "New plan",
        request: "",
        deadline: "",
        technology: "",
        capabilities: "",
        questions: "What should we plan?",
      },
      true,
    ).request,
    "",
  );
  assert.throws(() =>
    briefInput({ title: "New plan", request: "", questions: "" }),
  );
  const plan = clarificationPlan();
  assert.equal(validateGenerated(plan, []).kind, "clarification");
  plan.kind = "reuse";
  plan.sections[0].items[0] = {
    kind: "fact",
    text: "A pilot required review.",
    evidence: ["e1"],
  };
  assert.equal(validateGenerated(plan, evidence).kind, "reuse");
  const markdown = generatedMarkdown(plan, evidence);
  assert.match(markdown, /Recorded evidence/);
  assert.match(markdown, /\[S1\]/);
  plan.sections[0].items[0].evidence = ["fake"];
  assert.throws(() => validateGenerated(plan, evidence), /evidence/);
  plan.sections[0].items[0].evidence = [];
  assert.throws(() => validateGenerated(plan, evidence), /evidence/);
  plan.sections.pop();
  assert.throws(() => validateGenerated(plan, evidence), /invalid plan/);
});
test("Markdown references cannot be forged, relinked or silently renumbered", () => {
  assert.equal(
    validateMarkdown("Adapt the workflow [S1]", evidence),
    "Adapt the workflow [S1]",
  );
  assert.throws(() => validateMarkdown("Claim [S2]", evidence), /Unknown/);
  assert.throws(
    () => validateMarkdown("[S1]: https://foreign.invalid", evidence),
    /definitions/,
  );
  assert.throws(
    () => validateMarkdown("[S1 ]: https://foreign.invalid", evidence),
    /definitions/,
  );
  assert.throws(() => validateMarkdown("[S1] [bad]", evidence), /redefined/);
  assert.throws(
    () => validateMarkdown("[S1](https://foreign.invalid)", evidence),
    /redefined/,
  );
  assert.throws(() => validateMarkdown("[S1][bad]", evidence), /redefined/);
  assert.throws(() => validateMarkdown("[S01]", evidence), /Unknown/);
  assert.throws(() => validateMarkdown("x".repeat(50001), evidence));
  assert.deepEqual(referencedSources("No retained markers", evidence), []);
});
test("export uses saved text, includes durable excerpts, and retains source identity", () => {
  const plan = {
    title: "Original",
    saved_title: "Edited plan",
    kind: "reuse",
    saved_at: "2026-10-17",
    saved_markdown: "An edited next step [S1]",
    confirmed_request: {
      request: "New work",
      deadline: "Friday",
      technology: "",
      capabilities: "",
      questions: "",
    },
    snapshot: { warnings: ["Older context omitted"] },
    evidence,
    warnings: ["Bounded evidence"],
    generated_markdown: "Original generated draft",
  } as ReusePlan;
  const result = exportMarkdown(plan, "https://rewoven.dev");
  assert.match(result, /^# Edited plan/);
  assert.match(result, /An edited next step \[S1\]/);
  assert.match(result, /A pilot required review/);
  assert.match(result, /Version 1\. Physical page 2/);
  assert.match(result, /https:\/\/rewoven.dev\/case-library\//);
  assert.match(result, /active demo session/);
  assert.doesNotMatch(result, /Original generated draft/);
  assert.throws(
    () => exportMarkdown({ ...plan, saved_at: null }, "https://rewoven.dev"),
    /Save/,
  );
});
