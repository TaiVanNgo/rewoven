import { test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sourceLocation } from "../src/features/citations/source-context";
import { citationHref, requestCitation } from "../src/features/citations/types";
import { validateAnswer } from "../src/features/queries/validation";
import {
  documentEvidence,
  fileManifest,
  mergeRequestNodes,
  requestFindings,
} from "../src/features/query-files/content";
import type { StoredQueryFile } from "../src/features/query-files/types";

test("request files enforce formats, exact size, duplicate identifiers and per-message limits", () => {
  const file = { id: randomUUID(), title: "brief.pdf", size: 5_000_000 };
  assert.equal(fileManifest([file])[0].size, 5_000_000);
  for (const files of [
    [{ ...file, size: 5_000_001 }],
    [{ ...file, size: 0 }],
    [{ ...file, title: "brief.docx" }],
    [file, file],
    Array.from({ length: 6 }, () => ({ ...file, id: randomUUID() })),
  ])
    assert.throws(() => fileManifest(files));
});
test("request excerpts retain physical pages, exact Unicode offsets, tail requirements and separate citation routes", () => {
  const file = {
    id: randomUUID(),
    conversation_id: randomUUID(),
    title: "brief.pdf",
    version: 1,
    format: "pdf",
    pages: [
      { number: 1, text: "a ".repeat(26000) },
      { number: 2, text: "Require two-stage approval by Friday. 🧵" },
    ],
  } as StoredQueryFile;
  const evidence = documentEvidence(file);
  const tail = evidence.at(-1);
  assert.ok(tail);
  assert.equal(tail.page, 2);
  assert.equal(tail.text, file.pages[1].text.slice(tail.start, tail.end));
  const ref = requestCitation(tail);
  assert.equal(ref.requestDocument, true);
  assert.match(citationHref(ref), /^\/api\/query-files\//);
  const header = requestCitation({ ...tail, start: 0, end: 0, text: "" });
  assert.doesNotThrow(() =>
    sourceLocation(
      new URLSearchParams({
        page: "1",
        start: "0",
        ...(header.end ? { end: String(header.end) } : {}),
      }),
    ),
  );
});
test("readings accept only supplied excerpt IDs and bound hierarchical combinations", () => {
  const finding = {
    kind: "constraint",
    text: "Use PostgreSQL",
    evidence: ["r1"],
  };
  assert.equal(
    requestFindings({ findings: [finding] }, new Set(["r1"]))[0].text,
    finding.text,
  );
  assert.throws(() =>
    requestFindings({ findings: [finding] }, new Set(["another"])),
  );
  assert.throws(() =>
    requestFindings({ findings: [{ ...finding, evidence: [] }] }, new Set()),
  );
  const nodes = Array.from({ length: 5 }, () => ({ level: 0, findings: [] }));
  assert.deepEqual(mergeRequestNodes(nodes, false), [0, 1, 2, 3]);
  assert.deepEqual(
    mergeRequestNodes(
      [
        { level: 1, findings: [] },
        { level: 0, findings: [] },
      ],
      true,
    ),
    [0, 1],
  );
});
test("answers may cite request evidence without inventing historical passages", () => {
  const answer = {
    sections: [
      {
        kind: "fact",
        heading: "",
        text: "The request requires two approval stages.",
        evidence: ["r1"],
      },
    ],
  };
  assert.doesNotThrow(() => validateAnswer(answer, [], true, [{ id: "r1" }]));
  assert.throws(() => validateAnswer(answer, [], true, []));
});
