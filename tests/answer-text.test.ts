import { test } from "bun:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswerText } from "../src/features/queries/answer-text";

const render = (text: string) =>
  renderToStaticMarkup(createElement(AnswerText, { text }));

test("reply emphasis preserves surrounding text and supports several highlighted phrases", () => {
  const html = render("Compare **two cases** and check **the source** first.");
  assert.match(html, /Compare <strong>two cases<\/strong> and check/);
  assert.match(html, /<strong>the source<\/strong> first\./);
  assert.doesNotMatch(html, /\*\*/);
});

test("saved plain text and unfinished emphasis remain readable", () => {
  for (const text of [
    "A saved reply.\nAnother paragraph.",
    "Unclosed **phrase",
  ])
    assert.ok(render(text).includes(text));
  assert.doesNotMatch(render("**first\nsecond**"), /<strong>/);
});

test("numbered steps and bullet replies keep emphasis inside list items", () => {
  const ordered = render("1. Open **Case library**\n2. Attach a case");
  assert.match(ordered, /<ol /);
  assert.match(ordered, /<li>Open <strong>Case library<\/strong><\/li>/);
  const bullets = render("- Review **sources**\n\n- Compare limits");
  assert.match(bullets, /<ul /);
  assert.equal(bullets.match(/<li>/g)?.length, 2);
  assert.match(render("- A single **bullet**"), /<ul /);
});

test("model HTML and links remain inert text, including inside emphasis", () => {
  const html = render(
    "**<img src=x onerror=alert(1)>** <script>alert(1)</script> [link](javascript:alert(1))",
  );
  assert.doesNotMatch(html, /<(?:img|script|a)\b/);
  assert.match(html, /<strong>&lt;img/);
  assert.match(html, /&lt;script&gt;/);
  assert.ok(html.includes("[link](javascript:alert(1))"));
});

test("section citations stay inside their paragraph or at the end of a complete list", () => {
  const citations = createElement("a", { href: "/case-library/test" }, "[1]");
  const paragraph = renderToStaticMarkup(
    createElement(AnswerText, { text: "A supported finding.", citations }),
  );
  assert.match(paragraph, /A supported finding\. <a[^>]+>\[1\]<\/a><\/p>/);
  const list = renderToStaticMarkup(
    createElement(AnswerText, { text: "- First\n- Second", citations }),
  );
  assert.match(list, /<li>First<\/li><li>Second <a[^>]+>\[1\]<\/a><\/li>/);
  assert.equal(list.match(/\[1\]/g)?.length, 1);
});
