import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import {
  mergeIndexes,
  type ReadingWork,
  readingProgress,
} from "../src/features/cases/case-reading";
import type { CaseSuggestions } from "../src/features/cases/case-suggestions";

mock.module("server-only", () => ({}));
const { combineReadings } =
  await import("../src/features/cases/server/case-reading");
const empty: CaseSuggestions = {
  title: { value: "", evidence: [] },
  context: { value: "", evidence: [] },
  outcome: { value: "", evidence: [] },
  lessons: { value: "", evidence: [] },
};
function work(levels: number[], complete = false): ReadingWork {
  return {
    caseId: "case",
    sources: [],
    segments: [{ sourceId: "source", start: 0, end: 1 }],
    cursor: complete ? 1 : 0,
    nodes: levels.map((level) => ({
      level,
      suggestions: structuredClone(empty),
    })),
    calls: 0,
    warnings: [],
  };
}
test("reading hierarchy bounds each combination to four drafts and combines all remaining levels", () => {
  assert.deepEqual(mergeIndexes(work([0, 0, 0])), []);
  assert.deepEqual(mergeIndexes(work([1, 0, 0, 0, 0])), [1, 2, 3, 4]);
  assert.deepEqual(mergeIndexes(work([2, 1, 0], true)), [0, 1, 2]);
  assert.deepEqual(mergeIndexes(work([3], true)), []);
  const progress = readingProgress("id", "processing", work([1, 0], true));
  assert.equal(progress.phase, "combining");
  assert.equal(progress.completed, 1);
});
test("combining drafts restores exact source IDs, document titles, and original physical pages", async () => {
  const left = structuredClone(empty),
    right = structuredClone(empty);
  left.context = {
    value: "Feature was planned.",
    evidence: [
      {
        sourceId: "SRS",
        sourceTitle: "SRS.md",
        page: null,
        quote: "The plan proposes automated alerts.",
      },
    ],
  };
  right.context = {
    value: "The feature was postponed.",
    evidence: [
      {
        sourceId: "minutes",
        sourceTitle: "Minutes.pdf",
        page: 7,
        quote: "Automated alerts were postponed.",
      },
    ],
  };
  const result = await combineReadings(
    [left, right],
    { key: "fake", model: "fake" },
    async (_url, init) => {
      const body = JSON.parse(String(init.body)),
        input = JSON.parse(body.input[0].content);
      assert.equal(input.source_excerpts[0].source_title, "SRS.md");
      assert.equal(input.source_excerpts[1].original_page, 7);
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  ...empty,
                  context: {
                    value:
                      "The SRS proposes alerts; meeting minutes postpone them.",
                    evidence: [1, 2],
                  },
                }),
              },
            ],
          },
        ],
      });
    },
  );
  assert.deepEqual(result.context.evidence, [
    left.context.evidence[0],
    right.context.evidence[0],
  ]);
  assert.equal(result.outcome.value, "");
  await assert.rejects(
    combineReadings([left], { key: "fake", model: "fake" }, async () =>
      Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  ...empty,
                  context: { value: "bad", evidence: [99] },
                }),
              },
            ],
          },
        ],
      }),
    ),
    /does not identify/,
  );
});

test("section recovery retains verified fields, drops dangling empty citations, and never accepts unknown evidence", async () => {
  const { resolveSectionReferences } =
    await import("../src/features/cases/server/source-evidence");
  const warnings: string[] = [];
  const result = resolveSectionReferences(
    {
      title: { value: "Cedar", evidence: [1] },
      context: { value: "Unsupported", evidence: [99] },
      outcome: { value: "", evidence: [99] },
      lessons: { value: "", evidence: [] },
    },
    [{ id: 1, page: null, quote: "Project Cedar" }],
    [{ number: 1, text: "Project Cedar" }],
    false,
    warnings,
  );
  assert.equal(result.title.value, "Cedar");
  assert.equal(result.context.value, "");
  assert.deepEqual(result.outcome.evidence, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /context/);
});

test("structured synthesis restores original source versions and physical locations across documents", async () => {
  const { emptyOverview } = await import("../src/features/cases/case-overview");
  const left = structuredClone(empty),
    right = structuredClone(empty);
  left.overview = emptyOverview();
  right.overview = emptyOverview();
  left.overview.classification = "project";
  right.overview.classification = "project";
  const planned = {
    sourceId: "spec",
    sourceTitle: "Spec.pdf",
    sourceVersion: 2,
    page: 3,
    quote: "The plan proposes alerts.",
  };
  const changed = {
    sourceId: "retro",
    sourceTitle: "Retro.pdf",
    sourceVersion: 4,
    page: 9,
    quote: "Alerts did not ship.",
  };
  left.overview.sections.summary = [
    {
      id: "summary-1",
      text: "Alerts were proposed.",
      origin: "source",
      evidence: [planned],
    },
  ];
  right.overview.sections.gaps = [
    {
      id: "gaps-1",
      text: "Alerts did not ship.",
      origin: "source",
      evidence: [changed],
    },
  ];
  const result = await combineReadings(
    [left, right],
    { key: "test", model: "test" },
    async () =>
      Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  ...empty,
                  overview: {
                    classification: "project",
                    summary: [{ text: "Alerts were proposed.", evidence: [1] }],
                    problem: [],
                    approach: [],
                    results: [],
                    lessons: [],
                    gaps: [{ text: "Alerts did not ship.", evidence: [2] }],
                  },
                }),
              },
            ],
          },
        ],
      }),
  );
  assert.deepEqual(result.overview?.sections.summary[0].evidence, [planned]);
  assert.deepEqual(result.overview?.sections.gaps[0].evidence, [changed]);
});
