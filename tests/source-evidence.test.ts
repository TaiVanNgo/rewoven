import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractSource } from "../src/features/cases/extraction";

mock.module("server-only", () => ({}));
const { createSourceExcerpts, resolveSourceReferences } =
  await import("../src/features/cases/server/source-evidence");

test("excerpts preserve readable Unicode text, bounded quotes, and physical pages across empty pages", () => {
  const pages = [
    { number: 1, text: "   " },
    {
      number: 2,
      text: "Mình tested ‘office’ ligatures ﬁ and café.\n".repeat(40),
    },
    { number: 3, text: "a".repeat(599) + "🧵".repeat(700) },
  ];
  const excerpts = createSourceExcerpts(pages, true);
  assert.ok(excerpts.length > 3);
  assert.deepEqual(
    excerpts.map((excerpt) => excerpt.id),
    excerpts.map((_, index) => index + 1),
  );
  for (const page of pages) {
    const reconstructed = excerpts
      .filter((excerpt) => excerpt.page === page.number)
      .map((excerpt) => excerpt.quote)
      .join("");
    assert.equal(
      reconstructed.replace(/\s/gu, ""),
      page.text.replace(/\s/gu, ""),
    );
  }
  for (const excerpt of excerpts) {
    assert.ok(excerpt.quote.length > 0 && excerpt.quote.length <= 600);
    assert.equal(excerpt.quote.isWellFormed(), true);
    assert.ok(
      pages
        .find((page) => page.number === excerpt.page)
        ?.text.includes(excerpt.quote),
    );
  }
  assert.ok(
    createSourceExcerpts(pages, false).every(
      (excerpt) => excerpt.page === null,
    ),
  );
});

test("extracted PDF excerpts round-trip through the unchanged source validator", async () => {
  const source = await extractSource(
    new Uint8Array(await readFile("tests/fixtures/mixed-pages.pdf")),
    "pdf",
  );
  const excerpts = createSourceExcerpts(source.pages, true);
  assert.deepEqual(
    [...new Set(excerpts.map((excerpt) => excerpt.page))],
    [1, 3],
  );
  for (const excerpt of excerpts) {
    const input = {
      title: { value: "Example", evidence: [excerpt.id] },
      context: { value: "", evidence: [] },
      outcome: { value: "", evidence: [] },
      lessons: { value: "", evidence: [] },
    };
    assert.deepEqual(
      resolveSourceReferences(input, excerpts, source.pages, true).title
        .evidence,
      [{ page: excerpt.page, quote: excerpt.quote }],
    );
    assert.throws(
      () =>
        resolveSourceReferences(
          { ...input, title: { value: "Unsupported", evidence: [] } },
          excerpts,
          source.pages,
          true,
        ),
      /without matching evidence/,
    );
    assert.throws(
      () =>
        resolveSourceReferences(
          { ...input, title: { value: "", evidence: [excerpt.id] } },
          excerpts,
          source.pages,
          true,
        ),
      /without matching evidence/,
    );
  }
});
