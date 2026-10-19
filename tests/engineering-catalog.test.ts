import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  catalogNamespace,
  legacySampleIds,
  loadSampleCatalog,
  seedId,
} from "../scripts/sample-catalog";
import { chunkPages } from "../src/features/cases/extraction";
import {
  diagramAllowed,
  staticDiagramSource,
} from "../src/features/queries/diagram-policy";

test("engineering histories retain worked mechanisms, complete diagram passages and versioned identities", async () => {
  const catalog = await loadSampleCatalog();
  for (const item of catalog) {
    const notes = item.sources.find((s) => s.key === "notes");
    assert.ok(notes);
    const text = notes.extracted.text;
    assert.doesNotMatch(
      text,
      /Northbank|10,000,000|VND 10 million/,
      "Current client requirements must stay outside historical evidence",
    );
    assert.match(text, /Technical references and evidence status/);
    assert.match(text, /Failure trace|Hypothetical failure/);
    assert.match(text, /Worked trace|Worked success|Hypothetical success/);
    assert.match(text, /```sql/);
    assert.ok(
      legacySampleIds.includes(
        seedId(item.fixture.key, "rewoven-threadline-v1"),
      ),
    );
    assert.notEqual(item.id, seedId(item.fixture.key, "rewoven-threadline-v1"));
    const chunks = chunkPages(notes.extracted.pages, "md");
    const diagrams = [...text.matchAll(/```mermaid\n([\s\S]+?)\n```/g)];
    assert.ok(diagrams.length);
    for (const [, source] of diagrams) {
      assert.ok(
        diagramAllowed(source),
        `${item.fixture.title}: unsupported diagram`,
      );
      assert.ok(
        chunks.some((c) => c.text.includes(source)),
        "A complete diagram must fit in a retrievable passage",
      );
    }
    const authored = await readFile(
      `scripts/demo/engineering/${item.fixture.key}.md`,
      "utf8",
    );
    assert.ok(
      text.includes(
        authored
          .split("\n")
          .find(
            (line) =>
              line.startsWith("The fictional") ||
              line.startsWith("In this fictional"),
          ) ?? "explanatory",
      ),
    );
  }
  assert.match(
    catalog[3].sources[1].extracted.text,
    /Proposed replacement design, never implemented/,
  );
  assert.match(
    catalog[8].sources[1].extracted.text,
    /No application executed this trace/,
  );
});

test("unchanged catalogs retain identity while source revisions receive a new namespace", () => {
  const first = [{ key: "case", sources: [{ sha256: "original" }] }];
  assert.equal(
    catalogNamespace(first),
    catalogNamespace(JSON.parse(JSON.stringify(first))),
  );
  assert.notEqual(
    catalogNamespace(first),
    catalogNamespace([{ key: "case", sources: [{ sha256: "amended" }] }]),
  );
});

test("diagram policy permits static types and blocks configuration, links, HTML and resource styling", () => {
  assert.equal(
    staticDiagramSource(
      "flowchart LR\nA --> B\nstyle A fill:red\nclassDef default fill:blue",
    ),
    "flowchart LR\nA --> B",
  );
  for (const source of [
    "flowchart LR\nA --> B",
    "sequenceDiagram\nA->>B: Submit",
    "stateDiagram-v2\n[*] --> Draft",
    "erDiagram\nREQUEST ||--o{ EVENT : has",
  ])
    assert.ok(diagramAllowed(source), source);
  for (const source of [
    "flowchart LR\nA --> B\nclick A callback",
    "flowchart LR\n%%{init: {securityLevel: 'loose'}}%%",
    "flowchart LR\nA[<img src=x>]",
    "flowchart LR\nstyle A fill:url(/tracking)",
    "flowchart LR\nclassDef default fill:red",
    "flowchart LR\nA[https://example.com]",
    "pie\n1: 2",
    `flowchart LR\n${"a".repeat(2001)}`,
  ])
    assert.equal(diagramAllowed(source), false, source.slice(0, 100));
});
