import { describe, expect, test } from "bun:test";
import { Editor, type JSONContent } from "@tiptap/core";
import { validateMarkdown } from "../src/features/plans/content";
import {
  planEditorExtensions,
  planMarkdownManager,
  safePlanLink,
  selectionContainsCitedBlock,
  visualEditorLimitation,
} from "../src/features/plans/editor-markdown";

const manager = planMarkdownManager();
function nodes(doc: JSONContent): JSONContent[] {
  return [doc, ...(doc.content ?? []).flatMap(nodes)];
}

describe("saved-plan editor Markdown", () => {
  const examples = [
    "Plain paragraph with tiếng Việt.\n\nSecond paragraph.",
    "# Heading 1\n\n## Heading 2\n\n### Heading 3",
    "**Bold** and *italic* and ~~strike~~ and **bold *italic***.",
    "- First\n- Second\n  - Nested\n    - Deeply nested",
    "1. First\n2. Second\n   1. Nested",
    "> Quote with **emphasis**\n>\n> Second paragraph",
    "`inline [S1]` and ``code ` backtick``",
    "```ts\nconst source = '[S1]';\nconst html = '<script>ignored</script>';\n```",
    "Before\n\n---\n\nAfter",
    "[Website](https://example.com/path) and [Mail](mailto:tai@example.com) and [Local](/saved-plans)",
    "First line  \nSecond line",
    "Recorded evidence [S1], [S2].\n\n**Interpretation:** Reuse with review [S1].",
    "Literal \\[S1\\] and \\*asterisks\\* and a backslash \\\\.",
  ];
  for (const markdown of examples) {
    test(`preserves supported content: ${markdown.slice(0, 44)}`, () => {
      expect(visualEditorLimitation(markdown)).toBeNull();
      const parsed = manager.parse(markdown);
      expect(manager.parse(manager.serialize(parsed))).toEqual(parsed);
    });
  }

  test("keeps citation markers exact through repeated formatting and serialization", () => {
    for (const original of [
      "Claim [S1], [S2]",
      "[S1][S2]",
      "[S01]",
      "[S999999999999999999999999]",
    ]) {
      let markdown = original;
      for (let i = 0; i < 3; i++)
        markdown = manager.serialize(manager.parse(markdown));
      expect(markdown).toBe(original);
    }
    expect(() => validateMarkdown("[S1][S2]", [])).toThrow();
    expect(() => validateMarkdown("[S01]", [])).toThrow();
  });

  test("keeps citations beside emphasized claims with equivalent whitespace", () => {
    const markdown = "**Claim [S1]** and *claim [S2]*";
    expect(visualEditorLimitation(markdown)).toBeNull();
    expect(manager.serialize(manager.parse(markdown))).toBe(
      "**Claim** [S1] and *claim* [S2]",
    );
  });

  test("does not reinterpret escaped brackets or code as citation nodes", () => {
    const parsed = manager.parse(
      "Literal \\[S1\\], `[S2]`\n\n```text\n[S3]\n```",
    );
    expect(nodes(parsed).filter((n) => n.type === "planCitation")).toHaveLength(
      0,
    );
    expect(manager.serialize(parsed)).toContain("\\[S1\\]");
    expect(manager.serialize(parsed)).toContain("`[S2]`");
  });

  test("detects cited blocks at a caret and across selections while preserving chips under marks", () => {
    const editor = new Editor({
      element: null,
      extensions: planEditorExtensions(),
      content: manager.parse("Claim [S1]\n\nPlain paragraph"),
    });
    try {
      editor.commands.setTextSelection(2);
      expect(selectionContainsCitedBlock(editor)).toBe(true);
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      expect(selectionContainsCitedBlock(editor)).toBe(false);
      editor.commands.selectAll();
      expect(selectionContainsCitedBlock(editor)).toBe(true);
      editor.commands.toggleBold();
      expect(
        nodes(editor.getJSON()).filter((n) => n.type === "planCitation"),
      ).toHaveLength(1);
      expect(manager.serialize(editor.getJSON())).toContain("[S1]");
      editor.commands.toggleCode();
      expect(
        nodes(editor.getJSON()).filter((n) => n.type === "planCitation"),
      ).toHaveLength(1);
      expect(manager.serialize(editor.getJSON())).toContain("[S1]");
    } finally {
      editor.destroy();
    }
  });

  const unsupported = [
    ["| Name | Value |\n| --- | --- |\n| A | B |", "tables"],
    ["- [x] Done\n- [ ] Pending", "task lists"],
    ["- Nested\n  - [x] Done", "task lists"],
    ["Text <span>HTML</span>", "HTML"],
    ["<!-- retain this comment -->", "HTML"],
    ["<script>window.unsafe=true</script>", "HTML"],
    ["![Remote image](https://example.com/a.png)", "images"],
    ["[Example][ref]\n\n[ref]: https://example.com", "reference definitions"],
    ["[S1]: https://example.com", "reference definitions"],
    ["#### Heading 4", "headings below level 3"],
    ["[Unsafe](javascript:alert(1))", "unsupported or reserved links"],
    ["[Source [S1]](https://example.com)", "unsupported or reserved links"],
    ["\\# Literal heading marker", "formatting that cannot round-trip safely"],
  ];
  for (const [markdown, reason] of unsupported) {
    test(`routes ${reason} to source mode`, () => {
      expect(visualEditorLimitation(markdown)).toContain(reason);
    });
  }

  test("keeps unsupported syntax inside code available to the visual editor", () => {
    expect(
      visualEditorLimitation(
        "```md\n| x |\n- [x] task\n<script>\n![image](a)\n```\n\n`<span>`",
      ),
    ).toBeNull();
  });

  test("limits links to web, email and local URLs", () => {
    for (const href of [
      "https://example.com",
      "http://localhost:3002",
      "mailto:tai@example.com",
      "/case-library",
      "#heading",
      "./page",
      "../page",
    ])
      expect(safePlanLink(href)).toBe(true);
    for (const href of [
      "",
      "javascript:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "https://a\nb",
      "java\u0000script:x",
      "https://space here",
    ])
      expect(safePlanLink(href)).toBe(false);
  });
});
