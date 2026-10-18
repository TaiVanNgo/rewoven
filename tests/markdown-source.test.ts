import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownSource } from "../src/features/citations/markdown-source";

function render(text: string, quote?: string) {
  const start = quote ? text.indexOf(quote) : -1;
  return renderToStaticMarkup(
    createElement(MarkdownSource, {
      text,
      highlight:
        start >= 0 ? { start, end: start + (quote?.length ?? 0) } : null,
    }),
  );
}

test("Markdown sources render headings, emphasis, nested lists, quotes, code, and GFM tables", () => {
  const html = render(
    "# Pilot\n\n## Results\n\n**Bold** and *italic* and ~~removed~~.\n\n- Item\n  - Nested\n\n1. Step\n\n> Recorded\n\n`inline`\n\n```js\nconst x = 1;\n```\n\n| Metric | Value |\n| --- | --- |\n| Count | 3 |",
  );
  for (const expected of [
    "<h1>Pilot</h1>",
    "<h2>Results</h2>",
    "<strong>Bold</strong>",
    "<em>italic</em>",
    "<del>removed</del>",
    "<ul>",
    "<ol>",
    "<blockquote>",
    "<code>inline</code>",
    '<code class="language-js">',
    "<table>",
    "<th>Metric</th>",
    "<td>3</td>",
  ])
    expect(html).toContain(expected);
});

test("citation highlights cross Markdown nodes without breaking formatting", () => {
  const html = render(
    "## Results\n\nBefore **measured pilot** and *reviewed*. After.",
    "measured pilot** and *reviewed",
  );
  expect(html).toContain("<strong><mark>measured pilot</mark></strong>");
  expect(html).toContain("<mark> and </mark>");
  expect(html).toContain("<em><mark>reviewed</mark></em>");
  expect(html).not.toContain("<mark>Before");
});

test("partial citations use source offsets in headings, repeated text, Unicode, and code", () => {
  expect(render("# 🧵 Measured pilot", "Measured")).toContain(
    "<h1>🧵 <mark>Measured</mark> pilot</h1>",
  );
  expect(render("first **same** then same", "then same")).toContain(
    "<strong>same</strong> <mark>then same</mark>",
  );
  expect(render("`alpha beta`", "beta")).toContain(
    "<code>alpha <mark>beta</mark></code>",
  );
  expect(render("```txt\nalpha beta\n```", "beta")).toContain(
    "alpha <mark>beta</mark>",
  );
});

test("entities and escapes never produce an inaccurate partial highlight", () => {
  expect(render("A &amp; B", "&amp;")).not.toContain("<mark>");
  expect(render("A &amp; B", "A &amp; B")).toContain("<mark>A &amp; B</mark>");
  expect(render("Missing evidence")).not.toContain("<mark>");
});

test("uploaded Markdown cannot inject HTML, unsafe links, or remote images", () => {
  const html = render(
    "<script>alert(1)</script>\n\n[Unsafe](javascript:alert%281%29)\n\n![Tracking](https://example.com/image.png)\n\n[Safe](https://example.com)",
  );
  expect(html).not.toContain("<script");
  expect(html).not.toContain("javascript:");
  expect(html).not.toContain("<img");
  expect(html).toContain(
    'href="https://example.com" target="_blank" rel="noopener noreferrer"',
  );
});
