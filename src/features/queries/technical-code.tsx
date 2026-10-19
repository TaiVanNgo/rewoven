"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MermaidDiagram } from "./mermaid-diagram";

export function TechnicalCode({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const [copyState, setCopyState] = useState("Copy code");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("Copied");
    } catch {
      setCopyState("Copy failed; select the code");
    }
  }
  const diagram = language.toLowerCase() === "mermaid";
  return (
    <div className="query-code-block">
      <div className="query-code-toolbar">
        <span>
          {diagram ? "Architecture diagram" : language || "Code example"}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {diagram && copyState === "Copy code"
            ? "Copy diagram source"
            : copyState}
        </Button>
      </div>
      <output className="sr-only">
        {copyState === "Copy code" ? "" : copyState}
      </output>
      {diagram ? (
        <MermaidDiagram source={code} />
      ) : (
        <section
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll long code examples.
          tabIndex={0}
          aria-label={`${language || "Code"} example`}
          className="query-code-scroll"
        >
          <pre>
            <code>{code}</code>
          </pre>
        </section>
      )}
    </div>
  );
}
