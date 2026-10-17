import type { RequestDraft } from "@/features/requests/request-draft";
import type { Passage, RetrievalResult } from "@/features/retrieval/types";

export type QueryScope = "library" | "case" | "related";
export type QueryFocus = { scope: QueryScope; caseId: string | null };
export type QuerySummary = {
  id: string;
  title: string;
  updated_at: string;
};
export type Evidence = Passage & { id: string; stale?: boolean };
export type ChatContext = { mode: "library" | "selected"; caseIds: string[] };
export const EMPTY_CHAT_CONTEXT: ChatContext = { mode: "library", caseIds: [] };
export type AnswerSection = {
  kind: "fact" | "inference" | "recommendation" | "unknown" | "conversation";
  heading: string;
  text: string;
  evidence: string[];
};
export type QueryAnswer = { sections: AnswerSection[] };
export type QueryWork = {
  searchQuery: string;
  focusTitle: string | null;
  retrieval: RetrievalResult;
  evidence: Evidence[];
  focus: QueryFocus;
  clarification: string;
  candidates: { id: string; title: string }[];
};
export type QueryTurn = {
  id: string;
  ordinal: number;
  message: string;
  scope: QueryScope;
  focused_case_id: string | null;
  status: "processing" | "ready" | "failed";
  work: QueryWork | null;
  answer: QueryAnswer | null;
  error_message: string | null;
  started_at: string;
  context_snapshot?: ChatContext | null;
  phase?: "understanding" | "reviewing" | "answering" | null;
};
export type QueryConversation = QuerySummary & {
  assistant?: boolean;
  chat_context?: ChatContext;
  context_revision?: number;
  selected_cases?: { id: string; title: string; is_seed: boolean }[];
  request: RequestDraft;
  focused_case_id: string | null;
  turns: QueryTurn[];
};

export function evidenceHref(evidence: Passage) {
  return `/case-library/${evidence.case_id}?source=${evidence.source_id}&page=${evidence.page_number ?? 1}&start=${evidence.char_start}&end=${evidence.char_end}`;
}
