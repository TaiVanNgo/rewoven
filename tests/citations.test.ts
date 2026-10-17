import { test } from "bun:test";
import assert from "node:assert/strict";
import { emptyOverview } from "../src/features/cases/case-overview";
import {
  sourceContext,
  sourceLocation,
} from "../src/features/citations/source-context";
import {
  citationHref,
  citationKey,
  citationNumbers,
  findingCitation,
  passageCitation,
  previewQuery,
} from "../src/features/citations/types";

const reference = {
  caseId: "case",
  caseTitle: "Pilot",
  sourceId: "source",
  sourceTitle: "retro.pdf",
  version: 2,
  page: 3,
  quote: "Measured pilot results.",
};

test("citation numbering follows first appearance and reuses references, distinguishing pages and versions", () => {
  const second = { ...reference, page: 4 };
  const third = { ...reference, version: 3 };
  const numbers = citationNumbers([reference, second, reference, third]);
  assert.deepEqual([...numbers.values()], [1, 2, 3]);
  assert.equal(numbers.get(citationKey(reference)), 1);
});

test("citation adapters preserve source identity and legacy overview snapshot versions", () => {
  const overview = emptyOverview();
  overview.sources = [{ id: "source", version: 2 }];
  const finding = findingCitation(
    { sourceId: "source", page: 3, quote: reference.quote },
    { id: "case", title: "Pilot", overview },
  );
  assert.equal(finding.version, 2);
  assert.equal(
    findingCitation(
      { page: null, quote: "Saved" },
      { id: "case", title: "Pilot" },
    ).version,
    null,
  );
  const passage = passageCitation({
    case_id: "case",
    title: "Pilot",
    source_id: "source",
    source_title: "retro.pdf",
    version: 2,
    page_number: 3,
    char_start: 20,
    char_end: 40,
    text: reference.quote,
    chunk_id: "chunk",
    outcome: "",
    score: 1,
    stale: true,
  });
  assert.equal(passage.start, 20);
  assert.equal(passage.stale, true);
  assert.equal(
    new URL(citationHref(passage), "https://rewoven.test").searchParams.get(
      "version",
    ),
    "2",
  );
  assert.equal(previewQuery(passage, 4).has("start"), false);
  assert.equal(previewQuery(passage, 4).has("quote"), false);
});

test("source context highlights an exact offset and preserves surrounding text", () => {
  const text = `${"Before ".repeat(300)}Measured pilot results.${" After".repeat(1000)}`;
  const start = text.indexOf(reference.quote);
  const result = sourceContext(text, {
    version: 2,
    page: 3,
    start,
    end: start + reference.quote.length,
    quote: reference.quote,
  });
  assert.ok(result.highlight);
  assert.equal(
    result.text.slice(result.highlight.start, result.highlight.end),
    reference.quote,
  );
  assert.equal(result.start, start - 600);
  assert.ok(result.text.length <= 3000);
  assert.equal(
    sourceContext(text, {
      version: 2,
      page: 3,
      start,
      end: start + 3,
      quote: reference.quote,
    }).highlight,
    null,
  );
});

test("normalized quote lookup maps to original whitespace and Unicode without guessing missing quotes", () => {
  const text = "Intro 🧵\nMeasured\n\t pilot   results.\nEnd";
  const result = sourceContext(text, {
    version: 1,
    page: 1,
    quote: reference.quote,
  });
  assert.ok(result.highlight);
  assert.equal(
    result.text.slice(result.highlight.start, result.highlight.end),
    "Measured\n\t pilot   results.",
  );
  assert.equal(
    sourceContext(text, { version: 1, page: 1, quote: "Unknown result" })
      .highlight,
    null,
  );
  assert.equal(sourceContext("", { version: 1, page: 1, quote: "" }).text, "");
});

test("long quotes remain complete inside bounded context and invalid source locations are rejected", () => {
  const quote = "q".repeat(9000);
  const result = sourceContext(`Before ${quote} After`, {
    version: 1,
    page: 1,
    quote,
  });
  assert.ok(result.highlight);
  assert.equal(result.highlight.end - result.highlight.start, quote.length);
  for (const query of [
    "page=0",
    "page=1.2",
    "page=Infinity",
    "version=-1",
    "version=",
    "start=NaN",
    "start=3&end=2",
    "end=3",
    "start=0&end=10001",
    `quote=${"x".repeat(10001)}`,
  ])
    assert.throws(() => sourceLocation(new URLSearchParams(query)));
  assert.throws(() =>
    sourceContext("Short", { version: 1, page: 1, start: 6, quote: "" }),
  );
  assert.deepEqual(sourceLocation(new URLSearchParams()), {
    version: null,
    page: 1,
    start: undefined,
    end: undefined,
    quote: "",
  });
});
