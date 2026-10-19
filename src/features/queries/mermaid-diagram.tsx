"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";
import { diagramAllowed, staticDiagramSource } from "./diagram-policy";

// Mermaid's configuration is global: serialize configuration plus rendering so
// multiple stored answers and theme changes cannot race each other.
let renderQueue: Promise<unknown> = Promise.resolve();

export function MermaidDiagram({ source }: { source: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "default";
  const [result, setResult] = useState<{ key: string; svg: string } | null>(
    null,
  );
  const key = `${theme}:${source}`;
  const staticSource = staticDiagramSource(source);
  useEffect(() => {
    if (source.length > 2000 || !diagramAllowed(staticSource)) return;
    let cancelled = false;
    const render = async () => {
      if (cancelled) return;
      try {
        const [{ default: mermaid }, { default: purifier }] = await Promise.all(
          [import("mermaid"), import("dompurify")],
        );
        if (cancelled) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          htmlLabels: false,
          theme,
          maxTextSize: 2000,
          maxEdges: 50,
          suppressErrorRendering: true,
          flowchart: { htmlLabels: false },
        });
        const { svg } = await mermaid.render(
          `wren-diagram-${id}`,
          staticSource,
        );
        const safe = purifier.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: [
            "a",
            "image",
            "foreignObject",
            "script",
            "animate",
            "set",
          ],
          FORBID_ATTR: ["href", "xlink:href"],
        });
        if (!cancelled) setResult({ key, svg: safe });
      } catch {
        if (!cancelled) setResult({ key, svg: "" });
      }
    };
    renderQueue = renderQueue.then(render, render);
    return () => {
      cancelled = true;
    };
  }, [source, staticSource, theme, id, key]);
  const current = result?.key === key ? result : null;
  const rendered = !!current?.svg;
  return (
    <figure className="query-diagram">
      {rendered ? (
        <section
          // biome-ignore lint/a11y/noNoninteractiveTabindex: A wide diagram must be horizontally scrollable by keyboard.
          tabIndex={0}
          aria-label="Architecture diagram"
          className="query-diagram-image"
        >
          {/* biome-ignore lint/performance/noImgElement: Render generated SVG in the browser's inert image context, without inline HTML insertion. */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(current.svg)}`}
            alt="Architecture diagram; its source and labels are available below"
          />
        </section>
      ) : (
        <figcaption>
          {current || source.length > 2000 || !diagramAllowed(staticSource)
            ? "Diagram preview unavailable. The source is shown below."
            : "Preparing diagram. The source is available below."}
        </figcaption>
      )}
      <details open={!rendered}>
        <summary>Diagram source and labels</summary>
        <section
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the source.
          tabIndex={0}
          aria-label="Diagram source"
          className="query-code-scroll"
        >
          <pre>
            <code>{source}</code>
          </pre>
        </section>
      </details>
    </figure>
  );
}
