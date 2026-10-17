"use client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationMarker } from "@/features/citations/citation-marker";
import { citationHref, passageCitation } from "@/features/citations/types";
import type { Evidence } from "@/features/queries/types";
import { sourceDefinitions } from "./content";

export function PlanPreview({
  markdown,
  evidence,
}: {
  markdown: string;
  evidence: Evidence[];
}) {
  return (
    <div className="plan-prose wrap-anywhere">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={["img"]}
        components={{
          a: ({ href, children }) => {
            const index = evidence.findIndex(
              (e) => citationHref(passageCitation(e)) === href,
            );
            return index >= 0 ? (
              <CitationMarker
                reference={passageCitation(evidence[index])}
                number={index + 1}
              />
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >{`${markdown}\n\n${sourceDefinitions(evidence)}`}</Markdown>
    </div>
  );
}
