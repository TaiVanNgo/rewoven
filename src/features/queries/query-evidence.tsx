"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CitationMarker } from "@/features/citations/citation-marker";
import {
  citationKey,
  citationNumbers,
  passageCitation,
} from "@/features/citations/types";
import type { RetrievalResult } from "@/features/retrieval/types";
import type { Evidence, QueryTurn } from "./types";

export function answerCitationNumbers(turn: QueryTurn) {
  const evidence = turn.work?.evidence ?? [];
  const ordered =
    turn.answer?.sections.flatMap((section) =>
      section.evidence.flatMap((id) =>
        evidence.filter((item) => item.id === id),
      ),
    ) ?? [];
  return citationNumbers([...ordered, ...evidence].map(passageCitation));
}

export function Citation({
  evidence,
  number,
}: {
  evidence: Evidence;
  number: number;
}) {
  return (
    <CitationMarker reference={passageCitation(evidence)} number={number} />
  );
}
export function CaseCard({
  record,
  rank,
  focused,
  disabled,
  reason,
  onFocus,
  onRelated,
  numbers,
}: {
  record: RetrievalResult["cases"][number];
  rank: number;
  focused: boolean;
  disabled: boolean;
  reason?: string;
  onFocus: () => void;
  onRelated: () => void;
  numbers: Map<string, number>;
}) {
  return (
    <article className="query-case-card" data-focused={focused}>
      <p className="mb-2 text-xs font-semibold text-knowledge-ink">
        Result {rank}
      </p>
      <h3 className="font-heading text-lg leading-snug font-bold">
        {record.title}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {record.outcome ||
          "Outcome not recorded. These excerpts do not establish project success."}
      </p>
      {reason && <p className="mt-3 text-sm leading-relaxed">{reason}</p>}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold text-knowledge-ink">
          Inspect supporting excerpts ({record.passages.length})
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          {record.passages.map((passage) => (
            <blockquote
              key={passage.chunk_id}
              className="border-l-2 border-knowledge-ink pl-3"
            >
              <p className="max-h-44 overflow-y-auto text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap">
                {passage.text}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <CitationMarker
                  reference={passageCitation(passage)}
                  number={
                    numbers.get(citationKey(passageCitation(passage))) ?? 1
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {passage.source_title}
                  {passage.page_number ? ` · p. ${passage.page_number}` : ""}
                </span>
              </div>
            </blockquote>
          ))}
        </div>
      </details>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
        <Link
          href={`/case-library/${record.id}`}
          className="mr-auto self-center text-xs font-semibold underline underline-offset-4"
        >
          Inspect case
        </Link>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onFocus}
        >
          Ask Wren
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={onRelated}
        >
          Find related
        </Button>
      </div>
    </article>
  );
}
