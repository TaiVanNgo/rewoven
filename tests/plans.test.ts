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
import {
  planMarkdownManager,
  visualEditorLimitation,
} from "../src/features/plans/editor-markdown";
import {
  LEGACY_PLAN_HEADINGS,
  type LegacyGeneratedPlan,
  type ReusePlan,
} from "../src/features/plans/types";
import type { Evidence } from "../src/features/queries/types";
import { northbankPlan, registrationPlan } from "./fixtures/reuse-plan";

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
  assert.equal(
    validateGenerated(clarificationPlan(), []).kind,
    "clarification",
  );
  const plan = registrationPlan();
  assert.equal(validateGenerated(plan, evidence).kind, "reuse");
  const markdown = generatedMarkdown(plan, evidence);
  assert.doesNotMatch(
    markdown,
    /\*\*(Recorded evidence|Interpretation|Suggested action|Gap or question):/,
  );
  assert.match(markdown, /\[S1\]/);
  plan.sections[1].items[0].evidence = ["fake"];
  assert.throws(() => validateGenerated(plan, evidence), /evidence/);
  plan.sections[1].items[0].evidence = [];
  assert.throws(() => validateGenerated(plan, evidence), /evidence/);
  plan.sections.pop();
  assert.throws(() => validateGenerated(plan, evidence), /invalid plan/);
});
test("actionable plans lead with the outcome and retain numbered completion conditions through visual editing", () => {
  const plan = registrationPlan();
  plan.sections[3].items = [];
  plan.sections[4].items = [];
  plan.sections[1].items[0].evidence = ["e1", "e1"];
  const markdown = generatedMarkdown(
    validateGenerated(plan, evidence),
    evidence,
  );
  assert.match(markdown, /^## Proposed outcome\n\nFor the confirmed request/);
  assert.match(markdown, /Illustrative example/);
  assert.match(markdown, /## Implementation steps\n\n1\. Agree/);
  assert.match(markdown, /\n {3}\*\*Done when:\*\*/);
  assert.match(markdown, /\n2\. Build/);
  assert.doesNotMatch(
    markdown,
    /## Risks and limits|## Decisions to confirm|\[S1\], \[S1\]/,
  );
  assert.equal(visualEditorLimitation(markdown), null);
  const manager = planMarkdownManager();
  const restored = manager.serialize(manager.parse(markdown));
  assert.match(restored, /Done when/);
  assert.match(restored, /\[S1\]/);
  assert.deepEqual(manager.parse(restored), manager.parse(markdown));
});
test("generation rejects malformed versions, missing actions, misplaced completion text and unsupported references", () => {
  const invalid = [
    (p: ReturnType<typeof registrationPlan>) => {
      Object.assign(p, { formatVersion: 3 });
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections.reverse();
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[0].items = [];
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[1].items = [];
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[2].items = [];
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[2].items[0].doneWhen = "";
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[2].items[0].doneWhen = "Claim [S1]";
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[2].items[0].doneWhen = "x".repeat(501);
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[2].items[0].kind = "unknown";
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[0].items[0].kind = "fact";
      p.sections[0].items[0].evidence = ["e1"];
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[4].items[0].kind = "recommendation";
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[0].items[0].doneWhen = "Wrong section";
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[1].items[0].evidence = ["r_current"];
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[1].items[0].text += " [R1]";
    },
    (p: ReturnType<typeof registrationPlan>) => {
      p.sections[0].items.push(...p.sections[0].items);
    },
  ];
  for (const change of invalid) {
    const plan = registrationPlan();
    change(plan);
    assert.throws(() => validateGenerated(plan, evidence));
  }
  assert.throws(() => validateGenerated({ sections: [null] }, evidence));
});
test("clarification drafts omit reuse claims without inventing new requirements", () => {
  const plan = clarificationPlan();
  const markdown = generatedMarkdown(validateGenerated(plan, []), []);
  assert.doesNotMatch(markdown, /What to reuse|\[S\d+\]/);
  assert.match(markdown, /No suitable historical precedent/);
  assert.match(markdown, /1\. Collect/);
  assert.match(markdown, /Done when/);
  plan.sections[0].items[0].evidence = ["e1"];
  assert.throws(() => validateGenerated(plan, evidence), /evidence/);
});
test("partial evidence can support one reuse choice without padding the plan", () => {
  const plan = registrationPlan();
  plan.sections[1].items = plan.sections[1].items.slice(0, 1);
  plan.sections[2].items = plan.sections[2].items.slice(0, 1);
  const validated = validateGenerated(plan, evidence);
  assert.equal(validated.sections[1].items.length, 1);
  assert.equal(validated.sections[2].items.length, 1);
  assert.match(generatedMarkdown(validated, evidence), /\*\*Done when:\*\*/);
});
test("legacy unversioned plans keep their headings and exact Markdown format", () => {
  const plan: LegacyGeneratedPlan = {
    kind: "reuse",
    sections: LEGACY_PLAN_HEADINGS.map((heading) => ({
      heading,
      items: [
        { kind: "fact", text: "A pilot required review.", evidence: ["e1"] },
      ],
    })),
  };
  const expected = LEGACY_PLAN_HEADINGS.map(
    (heading) =>
      `## ${heading}\n\n- **Recorded evidence:** A pilot required review. [S1]`,
  ).join("\n\n");
  assert.equal(generatedMarkdown(plan, evidence), expected);
  assert.throws(() => validateGenerated(plan, evidence), /invalid plan/);
});
test("contradictory historical evidence retains both stable references without promoting a proposal to delivery", () => {
  const plan = registrationPlan();
  plan.sections[3].items = [
    {
      kind: "inference",
      text: "One source proposed automatic expiry; the review records manual expiry instead. Confirm suitability before adapting either approach.",
      evidence: ["e1", "e2"],
      doneWhen: "",
    },
  ];
  const sources = [
    evidence[0],
    {
      ...evidence[0],
      id: "e2",
      source_id: "other",
      text: "The review records manual expiry.",
    },
  ];
  const markdown = generatedMarkdown(validateGenerated(plan, sources), sources);
  assert.match(markdown, /proposed automatic expiry/);
  assert.match(markdown, /\[S1\], \[S2\]/);
  assert.deepEqual(
    referencedSources(markdown, sources).map((source) => source.number),
    [1, 2],
  );
});
test("Northbank mocked plan preserves critical rules in preview and saved export", () => {
  const sources = [
    evidence[0],
    { ...evidence[0], id: "e2", source_id: "retry" },
  ];
  const markdown = generatedMarkdown(
    validateGenerated(northbankPlan(), sources),
    sources,
  );
  for (const requirement of [
    "exactly VND 10,000,000 including tax",
    "manager review, then finance review",
    "requester cannot approve",
    "finance reviewer must differ",
    "line items, quantities, prices or tax",
    "invalidate approval and restart manager review",
    "Lost-response and concurrent retries create one request",
    "branch access on the server",
    "authorized scope and time range",
    "actor, server timestamp, action, revision and state changes",
    "four weeks as a requested constraint",
    "Exclude bank payments",
  ])
    assert.ok(markdown.includes(requirement), requirement);
  const plan = {
    title: "Northbank",
    saved_title: "Northbank",
    saved_at: "2026-10-19",
    saved_markdown: markdown,
    confirmed_request: { request: "Northbank pilot" },
    snapshot: { warnings: [] },
    warnings: [],
    kind: "reuse",
    evidence: sources,
  } as unknown as ReusePlan;
  const exported = exportMarkdown(plan, "https://rewoven.dev");
  assert.ok(exported.includes(markdown));
  assert.equal(visualEditorLimitation(markdown), null);
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
