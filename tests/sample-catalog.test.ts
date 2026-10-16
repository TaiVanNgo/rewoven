import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadSampleCatalog } from "../scripts/sample-catalog";
import { extractSource } from "../src/features/cases/extraction";

test("nine curated overviews cite original sources and preserve proposal, conflict, failure, language and synthetic boundaries", async () => {
  const catalog = await loadSampleCatalog();
  assert.equal(catalog.length, 9);
  const item = (id: string) => {
    const found = catalog.find((c) => c.fixture.key === id);
    assert.ok(found);
    return found;
  };
  for (const id of ["02", "03", "07", "08"])
    assert.equal(item(id).overview.sections.results.length, 0);
  assert.match(
    item("01").overview.sections.results[0].text,
    /46 minutes to 29/,
  );
  assert.match(item("03").overview.sections.gaps[0].text, /240.*228.*12/);
  const sensor = item("04");
  assert.equal(sensor.extracted.pages[5].text, "");
  assert.equal(sensor.overview.sections.results[0].evidence[0].page, 10);
  assert.match(
    sensor.overview.sections.results[0].text,
    /controlled bench replay/,
  );
  assert.match(item("05").overview.sections.results[0].text, /37 of 400/);
  assert.match(item("06").overview.sections.gaps[0].text, /not measured/);
  assert.match(item("07").overview.sections.gaps[0].text, /unmeasured/);
  assert.match(item("08").overview.sections.lessons[0].text, /Ghi rõ đơn vị/);
  assert.match(item("09").overview.sections.results[0].text, /synthetic/);
  const notebook = await extractSource(
    new Uint8Array(
      await readFile(
        "output/pdf/rewoven-test-pack/markdown/10-commonplace-notebook-no-project.md",
      ),
    ),
    "md",
  );
  assert.match(
    notebook.text,
    /not a software, delivery, research, or business project/,
  );
});
