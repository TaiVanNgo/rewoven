import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  conversationContext,
  namedCases,
  validatePlan,
} from "../src/features/queries/context";
import {
  type Evidence,
  evidenceHref,
  type QueryConversation,
} from "../src/features/queries/types";
import {
  focusInput,
  requestInput,
  validateAnswer,
} from "../src/features/queries/validation";

const caseId = "11111111-1111-4111-8111-111111111111";
const evidence: Evidence = {
  id: "e1",
  chunk_id: "chunk",
  source_id: "source",
  case_id: caseId,
  title: "Approval portal",
  source_title: "Retro.md",
  version: 2,
  page_number: 3,
  char_start: 12,
  char_end: 48,
  text: "The team shipped one manager approval.",
  outcome: "",
  score: 1,
};

test("query input preserves limits and requires explicit valid focus", () => {
  assert.equal(
    requestInput({ request: "  Compare approvals  " }).request,
    "Compare approvals",
  );
  assert.throws(() => requestInput({ request: " ", technology: "React" }));
  assert.throws(() => requestInput({ request: "a".repeat(10001) }));
  assert.throws(() =>
    requestInput({ request: "a", technology: "b".repeat(1001) }),
  );
  assert.deepEqual(focusInput({ scope: "related", caseId }), {
    scope: "related",
    caseId,
  });
  assert.throws(() => focusInput({ scope: "related" }));
  assert.throws(() => focusInput({ scope: "library", caseId }));
  assert.throws(() => focusInput({ scope: "case", caseId: "injected" }));
});
test("answers reject uncited claims and fabricated evidence but allow honest gaps", () => {
  const section = {
    kind: "fact",
    heading: "Approval stages",
    text: evidence.text,
    evidence: ["e1"],
  };
  assert.equal(
    validateAnswer({ sections: [section] }, [evidence]).sections.length,
    1,
  );
  for (const kind of ["fact", "inference", "recommendation"])
    assert.throws(() =>
      validateAnswer({ sections: [{ ...section, kind, evidence: [] }] }, [
        evidence,
      ]),
    );
  assert.throws(() =>
    validateAnswer(
      { sections: [{ ...section, evidence: ["other-session-id"] }] },
      [evidence],
    ),
  );
  assert.throws(() => validateAnswer({ sections: [] }, [evidence]));
  assert.throws(() =>
    validateAnswer({ sections: [{ ...section, text: "x".repeat(2001) }] }, [
      evidence,
    ]),
  );
  assert.equal(
    validateAnswer(
      {
        sections: [
          {
            ...section,
            kind: "unknown",
            text: "No outcome is recorded in these excerpts.",
            evidence: [],
          },
        ],
      },
      [],
    ).sections[0].kind,
    "unknown",
  );
});
test("citation links use server-resolved source locations", () => {
  assert.equal(
    evidenceHref(evidence),
    `/case-library?case=${caseId}&source=source&page=3&start=12&end=48`,
  );
});
test("case interpretation rejects invented identifiers and respects explicit focus", () => {
  const catalog = [{ id: caseId, title: "Expense Approval Portal" }];
  const plan = {
    query: "manager approval",
    caseId: null,
    related: false,
    clarification: "",
    candidates: [],
  };
  assert.equal(
    validatePlan(plan, catalog, { scope: "case", caseId }).caseId,
    caseId,
  );
  assert.equal(
    validatePlan({ ...plan, related: true }, catalog, { scope: "case", caseId })
      .related,
    false,
  );
  assert.throws(() =>
    validatePlan({ ...plan, caseId: "foreign" }, catalog, {
      scope: "library",
      caseId: null,
    }),
  );
  assert.throws(() =>
    validatePlan({ ...plan, candidates: ["foreign"] }, catalog, {
      scope: "library",
      caseId: null,
    }),
  );
  assert.equal(
    namedCases("Tell me about expense   approval portal", catalog)[0].id,
    caseId,
  );
});
test("bounded history preserves the original request and discloses excluded turns", () => {
  const conversation: QueryConversation = {
    id: caseId,
    title: "Approvals",
    updated_at: "",
    request: {
      request: "Build two approval stages",
      technology: "React",
      deadline: "6 weeks",
      capabilities: "Audit log",
    },
    focused_case_id: null,
    turns: [],
  };
  for (let ordinal = 1; ordinal <= 12; ordinal++)
    conversation.turns.push({
      id: String(ordinal),
      ordinal,
      message: `Question ${ordinal}`,
      scope: "library",
      focused_case_id: null,
      status: "ready",
      answer: null,
      work: null,
      error_message: null,
      started_at: "",
    });
  const context = conversationContext(conversation, conversation.turns[11]);
  assert.equal(context.originalRequest.capabilities, "Audit log");
  assert.equal(context.history.length, 8);
  assert.equal(context.history.at(-1)?.question, "Question 11");
  assert.equal(context.warnings.length, 1);
});
