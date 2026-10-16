import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  chunkPages,
  extractSourceStage,
} from "../src/features/cases/extraction";
import {
  EMBEDDING_DIMENSIONS,
  groupPassages,
  meanQueryVector,
} from "../src/features/retrieval/embedding-math";

test("query pooling normalizes weighted passage vectors", () => {
  const a = Array<number>(EMBEDDING_DIMENSIONS).fill(0),
    b = [...a];
  a[0] = 1;
  b[1] = 1;
  const mean = meanQueryVector([a, b], [3, 4]);
  assert.equal(mean[0], 0.6);
  assert.equal(mean[1], 0.8);
  assert.throws(() =>
    meanQueryVector([Array(EMBEDDING_DIMENSIONS).fill(0)], [1]),
  );
});
test("case grouping uses the strongest passage order without rewarding larger documents", () => {
  const passage = (id: string, n: number) => ({
    case_id: id,
    title: id,
    outcome: "",
    source_id: id,
    char_start: n,
    page_number: null,
  });
  const grouped = groupPassages([
    passage("A", 1),
    passage("B", 1),
    ...Array.from({ length: 8 }, (_, i) => passage("A", i + 2)),
    passage("C", 1),
    passage("D", 1),
  ]);
  assert.deepEqual(
    grouped.map((c) => c.id),
    ["A", "B", "C"],
  );
  assert.equal(grouped[0].passages.length, 3);
});
test("checkpointed extraction retains source locations and long-document tail evidence", async () => {
  const bytes = new Uint8Array(
    await readFile("tests/fixtures/too-much-text.pdf"),
  );
  let stage = await extractSourceStage(bytes, "pdf");
  while (!stage.complete) {
    const previous = stage.pages;
    stage = await extractSourceStage(bytes, "pdf", stage.pages, stage.warnings);
    assert.deepEqual(stage.pages.slice(0, previous.length), previous);
  }
  const text =
    "background ".repeat(6000) +
    "\nEvidence at the end: penguin reconciliation.";
  const chunks = chunkPages([{ number: 1, text }], "md");
  assert.ok(text.length > 50000);
  assert.ok(chunks.at(-1)?.text.includes("penguin reconciliation"));
  assert.equal(chunks.map((c) => c.text).join(""), text);
});

test("PDF checkpoints process ten pages and never silently truncate excessive extracted text", async () => {
  const { pdfFixture } = await import("./pdf-fixture");
  const bytes = pdfFixture(
    Array.from({ length: 11 }, (_, i) => `Physical page ${i + 1}`),
  );
  const first = await extractSourceStage(bytes, "pdf");
  assert.equal(first.complete, false);
  assert.equal(first.pages.length, 10);
  const last = await extractSourceStage(
    bytes,
    "pdf",
    first.pages,
    first.warnings,
  );
  assert.equal(last.complete, true);
  assert.equal(last.pages[10].number, 11);
  assert.match(last.pages[10].text, /Physical page 11/);
  await assert.rejects(
    extractSourceStage(pdfFixture(["a".repeat(500001)]), "pdf"),
    /500,000/,
  );
});

test("chunks preserve Unicode surrogate pairs at the passage boundary", () => {
  const text = `${"x".repeat(1999)}🐧${"y".repeat(2000)}`;
  const chunks = chunkPages([{ number: 1, text }], "md");
  assert.equal(chunks.map((c) => c.text).join(""), text);
  for (const c of chunks) assert.equal(c.text.isWellFormed(), true);
});
