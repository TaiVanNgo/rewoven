"use client";

import { BookOpenIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { RetrievalResult } from "@/features/retrieval/types";
import { type Evidence, evidenceHref } from "./types";

export function Citation({ evidence }: { evidence: Evidence }) {
  if (evidence.stale)
    return (
      <Link
        href={`/case-library/${evidence.case_id}`}
        className="query-citation"
      >
        {evidence.source_title} · saved v{evidence.version} · inspect current
        case
      </Link>
    );
  return (
    <Link
      href={evidenceHref(evidence)}
      className="query-citation"
      title={evidence.text}
    >
      <BookOpenIcon className="size-3 shrink-0" aria-hidden="true" />
      <span className="wrap-anywhere">
        {evidence.source_title}
        {evidence.page_number ? ` · p. ${evidence.page_number}` : ""} · v
        {evidence.version}
      </span>
    </Link>
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
}: {
  record: RetrievalResult["cases"][number];
  rank: number;
  focused: boolean;
  disabled: boolean;
  reason?: string;
  onFocus: () => void;
  onRelated: () => void;
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
              <Link
                href={evidenceHref(passage)}
                className="mt-2 block text-xs font-semibold text-knowledge-ink underline underline-offset-4"
              >
                {passage.source_title} · v{passage.version}
                {passage.page_number ? ` · p. ${passage.page_number}` : ""}
              </Link>
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
