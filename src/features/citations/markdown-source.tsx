import type { Element, Root, RootContent, Text } from "hast";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SourcePreview } from "./types";
import "./markdown-source.css";

type HighlightOptions = Pick<SourcePreview, "text" | "highlight">;

// Apply marks after parsing so citations spanning Markdown syntax never break it.
function rehypeCitationHighlight({ text, highlight }: HighlightOptions) {
  return (tree: Root) => {
    if (!highlight) return;
    const range = highlight;
    function visit(parent: Root | Element) {
      parent.children = parent.children.flatMap((node): RootContent[] => {
        if (node.type === "element") {
          visit(node);
          return [node];
        }
        if (node.type !== "text" || !node.value) return [node];
        const position = node.position ?? parent.position;
        let start = position?.start.offset;
        const end = position?.end.offset;
        if (start === undefined || end === undefined) return [node];
        const raw = text.slice(start, end);
        if (raw !== node.value) {
          // Code leaves inherit their parent location, including fence delimiters.
          const index = raw.indexOf(node.value);
          if (index >= 0 && raw.indexOf(node.value, index + 1) < 0) {
            start += index;
          } else {
            // Entities/escapes can change character counts. Only mark the entire
            // leaf when its full source span is cited; never guess partial offsets.
            return range.start <= start && range.end >= end
              ? [mark(node.value)]
              : [node];
          }
        }
        const from = Math.max(0, range.start - start);
        const to = Math.min(node.value.length, range.end - start);
        if (from >= to) return [node];
        return [
          { type: "text", value: node.value.slice(0, from) },
          mark(node.value.slice(from, to)),
          { type: "text", value: node.value.slice(to) },
        ];
      });
    }
    visit(tree);
  };
}

function mark(value: string): Element {
  const child: Text = { type: "text", value };
  return {
    type: "element",
    tagName: "mark",
    properties: {},
    children: [child],
  };
}

export function MarkdownSource({ text, highlight }: HighlightOptions) {
  return (
    <div className="source-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeCitationHighlight, { text, highlight }]]}
        skipHtml
        disallowedElements={["img"]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="source-markdown-table">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
