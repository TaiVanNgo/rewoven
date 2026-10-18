import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { legacySampleIds, loadSampleCatalog } from "../scripts/sample-catalog";
import { extractSource } from "../src/features/cases/extraction";

test("nine Threadline projects retain three originals, exact evidence and honest delivery status", async () => {
  const catalog = await loadSampleCatalog();
  assert.equal(catalog.length, 9);
  assert.equal(catalog.flatMap((c) => c.sources).length, 27);
  assert.ok(catalog.every((c) => !legacySampleIds.includes(c.id)));
  for (const item of catalog) {
    assert.equal(item.overview.sources.length, 3);
    assert.deepEqual(
      item.sources.map((s) => s.key),
      ["brief", "notes", "review"],
    );
    const review = item.sources[2];
    assert.equal(review.extracted.pages.length, 2);
    assert.ok(review.extracted.pages[0].text.includes("Threadline Delivery"));
    assert.ok(item.sources.every((s) => s.extracted.warnings.length === 0));
    for (const findings of Object.values(item.overview.sections))
      for (const finding of findings) {
        assert.ok(finding.evidence.length);
        for (const reference of finding.evidence)
          assert.ok(
            item.sources.some((s) => s.sourceId === reference.sourceId),
          );
      }
  }
  const proposal = catalog[8];
  assert.equal(proposal.overview.sections.results.length, 0);
  assert.match(
    proposal.overview.sections.gaps[0].text,
    /implementation.*not established/,
  );
  assert.match(
    catalog[3].overview.sections.results[0].text,
    /stopped.*manually/,
  );
  assert.match(
    catalog[1].overview.sections.results[0].text,
    /controlled.*checks/i,
  );
  assert.match(catalog[7].overview.sections.gaps[0].text, /outside/);
});

test("client inputs extract with physical page locations and stay outside the seed manifest", async () => {
  const root = "output/pdf/rewoven-purchase-demo/upload/Client input/";
  const brief = await extractSource(
    new Uint8Array(await readFile(`${root}client-brief.pdf`)),
    "pdf",
  );
  assert.equal(brief.pages.length, 2);
  assert.deepEqual(brief.warnings, []);
  assert.match(brief.pages[0].text, /10,000,000 or more/);
  assert.match(brief.pages[1].text, /Retri|Retry|Retrying/);
  const constraints = await readFile(`${root}constraints.md`, "utf8");
  assert.match(constraints, /exactly VND 10,000,000 takes both stages/);
  const catalog = await loadSampleCatalog();
  assert.ok(
    catalog.every((c) =>
      c.sources.every((s) => !s.file.includes("Client input")),
    ),
  );
});
