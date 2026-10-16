import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import {
  emptyOverview,
  overviewProjection,
  overviewStale,
  reviewOverview,
} from "../src/features/cases/case-overview";

mock.module("server-only", () => ({}));
const { resolveSourceReferences } =
  await import("../src/features/cases/server/source-evidence");

test("editing a finding removes inherited or forged citations; unchanged findings keep only server evidence", () => {
  const original = emptyOverview();
  original.classification = "project";
  original.provenance = "ai";
  original.sources = [{ id: "source", version: 2 }];
  original.sections.results = [
    {
      id: "r1",
      text: "The rollout failed.",
      origin: "source",
      evidence: [
        {
          sourceId: "source",
          sourceVersion: 2,
          page: 3,
          quote: "Rollout stopped.",
        },
      ],
    },
  ];
  const submitted = structuredClone(original);
  submitted.sections.results[0].evidence[0].quote = "Forged success";
  assert.equal(
    reviewOverview(submitted, original).sections.results[0].evidence[0].quote,
    "Rollout stopped.",
  );
  submitted.sections.results[0].text = "My amended result";
  const reviewed = reviewOverview(submitted, original);
  assert.deepEqual(reviewed.sections.results[0].evidence, []);
  assert.equal(reviewed.sections.results[0].origin, "user");
  const retyped = structuredClone(reviewed);
  retyped.sections.results[0].text = original.sections.results[0].text;
  assert.deepEqual(
    reviewOverview(retyped, original).sections.results[0].evidence,
    [],
  );
  assert.equal(overviewProjection(reviewed).outcome, "My amended result");
  assert.equal(overviewStale(reviewed, [{ id: "source", version: 3 }]), true);
  assert.equal(overviewStale(reviewed, original.sources), false);
});

test("structured extraction resolves exact original-page evidence and rejects unknown references", () => {
  const fields = Object.fromEntries(
    ["title", "context", "outcome", "lessons"].map((key) => [
      key,
      { value: "", evidence: [] },
    ]),
  );
  const overview = {
    classification: "project",
    summary: [{ text: "The rollout failed.", evidence: [1] }],
    problem: [],
    approach: [],
    results: [],
    lessons: [],
    gaps: [],
  };
  const excerpts = [{ id: 1, page: 7, quote: "The rollout failed." }];
  const pages = [{ number: 7, text: "The rollout failed." }];
  const result = resolveSourceReferences(
    { ...fields, overview },
    excerpts,
    pages,
    true,
  );
  assert.equal(result.overview?.sections.summary[0].evidence[0].page, 7);
  assert.throws(
    () =>
      resolveSourceReferences(
        {
          ...fields,
          overview: {
            ...overview,
            summary: [{ text: "Claim", evidence: [2] }],
          },
        },
        excerpts,
        pages,
        true,
      ),
    /supplied source excerpt/,
  );
  assert.throws(
    () =>
      resolveSourceReferences(
        { ...fields, overview: { ...overview, classification: "non_project" } },
        excerpts,
        pages,
        true,
      ),
    /Non-project/,
  );
  const control = resolveSourceReferences(
    {
      ...fields,
      overview: { ...overview, classification: "non_project", summary: [] },
    },
    excerpts,
    pages,
    true,
  );
  assert.equal(control.overview?.classification, "non_project");
  assert.equal(
    Object.values(control.overview?.sections ?? {}).flat().length,
    0,
  );
});

test("overview validation bounds findings and rejects ambiguous identifiers", () => {
  const draft = emptyOverview();
  const finding = {
    id: "same",
    text: "A contributor note",
    origin: "user" as const,
    evidence: [],
  };
  draft.sections.gaps = [finding, finding];
  assert.throws(() => reviewOverview(draft, null), /unique IDs/);
  draft.sections.gaps = [{ ...finding, text: "x".repeat(601) }];
  assert.throws(() => reviewOverview(draft, null), /600/);
});
