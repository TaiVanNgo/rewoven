import {
  type Editor,
  Extension,
  type JSONContent,
  Node,
  nodeInputRule,
} from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

// These are references into the plan's existing evidence map, never URLs or HTML.
export const PlanCitation = Node.create({
  name: "planCitation",
  group: "inline",
  inline: true,
  atom: true,
  marks: "",
  addAttributes() {
    return { number: { default: "1" } };
  },
  parseHTML() {
    // Pasted HTML cannot manufacture trusted citation attributes.
    return [];
  },
  renderHTML({ node }) {
    return ["span", { class: "plan-citation" }, `[S${node.attrs.number}]`];
  },
  renderText({ node }) {
    return `[S${node.attrs.number}]`;
  },
  markdownTokenizer: {
    name: "planCitation",
    level: "inline",
    start: (src) => src.indexOf("[S"),
    tokenize(src) {
      const match = /^\[S(\d+)\]/.exec(src);
      if (!match) return undefined;
      return { type: "planCitation", raw: match[0], number: match[1] };
    },
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode("planCitation", { number: token.number }),
  renderMarkdown: (node) => `[S${node.attrs?.number}]`,
  addInputRules() {
    return [
      nodeInputRule({
        find: /\[S([1-9]\d*)\]$/,
        type: this.type,
        getAttributes: (match) => ({ number: match[1] }),
      }),
    ];
  },
});

export function safePlanLink(href: string) {
  // Permit web, email, and local references; reject controls and other schemes.
  if (
    !href.trim() ||
    /\s/.test(href) ||
    [...href].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    return false;
  return /^(https?:\/\/|mailto:|\/|#|\.\.?\/)/i.test(href);
}

export function selectionContainsCitedBlock(editor: Editor) {
  let cited = false;
  const { from, to } = editor.state.selection;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.isTextblock) {
      node.descendants((child) => {
        if (child.type.name === "planCitation") cited = true;
      });
      return false;
    }
  });
  return cited;
}

// ProseMirror drops non-text inline nodes when turning a paragraph into code.
// Guard the built-in shortcut as well as the toolbar to preserve references.
const CitationSafeCodeBlocks = Extension.create({
  name: "citationSafeCodeBlocks",
  priority: 1000,
  addKeyboardShortcuts() {
    return { "Mod-Alt-c": () => selectionContainsCitedBlock(this.editor) };
  },
});

export function planEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      underline: false,
      trailingNode: false,
      link: {
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        isAllowedUri: safePlanLink,
      },
    }),
    PlanCitation,
    CitationSafeCodeBlocks,
  ];
}

export function planMarkdownManager() {
  return new MarkdownManager({ extensions: planEditorExtensions() });
}

const compatibilityParser = planMarkdownManager();

// Whitespace at an emphasis boundary has no visual formatting. The serializer
// moves it outside the mark; compare that equivalent form before permitting edits.
function comparableDocument(node: JSONContent): JSONContent {
  if (!node.content) return node;
  const content: JSONContent[] = [];
  for (const child of node.content.map(comparableDocument)) {
    const parts: JSONContent[] = [];
    if (
      child.type === "text" &&
      child.marks?.length &&
      !child.marks.some((m) => m.type === "code")
    ) {
      const text = child.text ?? "";
      const leading = text.match(/^\s+/)?.[0] ?? "";
      const trailing = text.trim() ? (text.match(/\s+$/)?.[0] ?? "") : "";
      if (leading) parts.push({ type: "text", text: leading });
      if (text.trim()) parts.push({ ...child, text: text.trim() });
      if (trailing) parts.push({ type: "text", text: trailing });
    } else parts.push(child);
    for (const part of parts) {
      const previous = content.at(-1);
      if (
        part.type === "text" &&
        previous?.type === "text" &&
        JSON.stringify(part.marks ?? []) ===
          JSON.stringify(previous.marks ?? [])
      )
        previous.text = (previous.text ?? "") + part.text;
      else content.push({ ...part });
    }
  }
  return { ...node, content };
}

export function visualEditorLimitation(markdown: string): string | null {
  const unsupported = new Set<string>();
  function inspect(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(inspect);
      return;
    }
    const token = value as Record<string, unknown>;
    const labels: Record<string, string> = {
      table: "tables",
      image: "images",
      html: "HTML",
      def: "reference definitions",
    };
    if (typeof token.type === "string" && labels[token.type])
      unsupported.add(labels[token.type]);
    if (token.type === "list_item" && token.task) unsupported.add("task lists");
    if (token.type === "heading" && Number(token.depth) > 3)
      unsupported.add("headings below level 3");
    if (
      token.type === "link" &&
      (!safePlanLink(String(token.href)) ||
        /^(?:S\d+)$|\[S\d+\]/i.test(String(token.text)))
    )
      unsupported.add("unsupported or reserved links");
    Object.values(token).forEach(inspect);
  }
  try {
    const tokens = compatibilityParser.instance.lexer(markdown);
    inspect(tokens);
    // Marked stores reference definitions in an array property, not its items.
    if (Object.keys(tokens.links).length)
      unsupported.add("reference definitions");
    if (!unsupported.size) {
      const parsed = compatibilityParser.parse(markdown);
      const restored = compatibilityParser.parse(
        compatibilityParser.serialize(parsed),
      );
      if (
        JSON.stringify(comparableDocument(parsed)) !==
        JSON.stringify(comparableDocument(restored))
      )
        unsupported.add("formatting that cannot round-trip safely");
    }
  } catch {
    return "This Markdown could not be opened safely in the visual editor. Continue editing its source.";
  }
  return unsupported.size
    ? `Use Markdown mode to preserve ${[...unsupported].join(", ")}. Visual editing is available when this content is removed.`
    : null;
}
