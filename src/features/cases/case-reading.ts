import {
  type CaseAnalysis,
  type CaseSuggestions,
  SUGGESTION_FIELDS,
} from "./case-suggestions";
import type { CaseRecord } from "./types";
export const CASE_READING_VERSION = 4;
export const READING_EXCERPTS_PER_STEP = 32;
export type ReadingSource = {
  id: string;
  title: string;
  format: string;
  version: number;
  chars: number;
  hash: string;
  pages: number;
};
export type ReadingWork = {
  caseId: string;
  sources: ReadingSource[];
  segments: { sourceId: string; start: number; end: number }[];
  cursor: number;
  nodes: { level: number; suggestions: CaseSuggestions }[];
  calls: number;
  warnings: string[];
};
export type ReadingProgress = {
  id: string;
  status: "processing" | "ready" | "failed";
  phase: "reading" | "combining" | "ready";
  completed: number;
  total: number;
  documents: number;
  error: string | null;
  result: CaseAnalysis | null;
};
export function mergeIndexes(work: ReadingWork): number[] {
  const levels = new Map<number, number[]>();
  for (const [index, node] of work.nodes.entries()) {
    const list = levels.get(node.level) ?? [];
    list.push(index);
    levels.set(node.level, list);
    if (list.length === 4) return list;
  }
  return work.cursor === work.segments.length && work.nodes.length > 1
    ? work.nodes.slice(0, 4).map((_, i) => i)
    : [];
}
export function readingProgress(
  id: string,
  status: ReadingProgress["status"],
  work: ReadingWork,
  error: string | null = null,
  result: CaseAnalysis | null = null,
): ReadingProgress {
  return {
    id,
    status,
    phase:
      status === "ready"
        ? "ready"
        : mergeIndexes(work).length
          ? "combining"
          : "reading",
    completed: work.cursor,
    total: work.segments.length,
    documents: work.sources.length,
    error,
    result,
  };
}
export function caseFields(
  record: Pick<CaseRecord, "title" | "context" | "outcome" | "lessons">,
) {
  return Object.fromEntries(
    SUGGESTION_FIELDS.map((field) => [field, record[field]]),
  ) as Record<(typeof SUGGESTION_FIELDS)[number], string>;
}
