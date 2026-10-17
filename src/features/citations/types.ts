import type {
  CaseOverview,
  OverviewEvidence,
} from "@/features/cases/case-overview";
import type { Passage } from "@/features/retrieval/types";

export type CitationReference = {
  caseId: string;
  caseTitle: string;
  sourceId: string;
  sourceTitle: string;
  version: number | null;
  page: number | null;
  start?: number;
  end?: number;
  quote: string;
  stale?: boolean;
};

export type SourcePreview = {
  source: {
    id: string;
    title: string;
    format: string;
    version: number;
    pageCount: number;
  };
  page: number;
  text: string;
  start: number;
  highlight: { start: number; end: number } | null;
  pdfUrl: string | null;
};

export function passageCitation(
  passage: Passage & { stale?: boolean },
): CitationReference {
  return {
    caseId: passage.case_id,
    caseTitle: passage.title,
    sourceId: passage.source_id,
    sourceTitle: passage.source_title,
    version: passage.version,
    page: passage.page_number,
    start: passage.char_start,
    end: passage.char_end,
    quote: passage.text,
    stale: passage.stale,
  };
}

export function findingCitation(
  evidence: OverviewEvidence,
  record: { id: string; title: string; overview?: CaseOverview | null },
): CitationReference {
  return {
    caseId: record.id,
    caseTitle: record.title,
    sourceId: evidence.sourceId ?? "",
    sourceTitle: evidence.sourceTitle ?? "Source",
    version:
      evidence.sourceVersion ??
      record.overview?.sources.find((s) => s.id === evidence.sourceId)
        ?.version ??
      null,
    page: evidence.page,
    quote: evidence.quote,
  };
}

export function citationKey(reference: CitationReference) {
  return JSON.stringify([
    reference.sourceId,
    reference.version,
    reference.page,
    reference.start ?? null,
    reference.end ?? null,
    reference.quote,
  ]);
}

export function citationNumbers(references: CitationReference[]) {
  const numbers = new Map<string, number>();
  for (const reference of references) {
    const key = citationKey(reference);
    if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
  }
  return numbers;
}

export function citationHref(reference: CitationReference) {
  const query = new URLSearchParams({
    source: reference.sourceId,
    page: String(reference.page ?? 1),
  });
  if (reference.version !== null)
    query.set("version", String(reference.version));
  if (reference.start !== undefined)
    query.set("start", String(reference.start));
  if (reference.end !== undefined) query.set("end", String(reference.end));
  // Finding quotes can be located again when a link is opened in a new tab.
  if (reference.start === undefined && reference.quote)
    query.set("quote", reference.quote);
  return `/case-library/${reference.caseId}?${query}`;
}

export function previewQuery(
  reference: CitationReference,
  page = reference.page ?? 1,
) {
  const query = new URLSearchParams({ page: String(page) });
  if (reference.version !== null)
    query.set("version", String(reference.version));
  if (page === (reference.page ?? 1)) {
    if (reference.start !== undefined)
      query.set("start", String(reference.start));
    if (reference.end !== undefined) query.set("end", String(reference.end));
    if (reference.quote) query.set("quote", reference.quote);
  }
  return query;
}
