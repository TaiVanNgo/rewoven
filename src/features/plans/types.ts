import type { ChatContext, Evidence } from "@/features/queries/types";
import type {
  RequestDocumentContext,
  RequestEvidence,
} from "@/features/query-files/types";
import type { RequestDraft } from "@/features/requests/request-draft";

export type PlanBrief = RequestDraft & { title: string; questions: string };
export type PlanSnapshot = {
  requestDocuments?: RequestDocumentContext;
  context: ChatContext;
  originalRequest: RequestDraft;
  messages: string[];
  throughTurnId: string | null;
  warnings: string[];
};
export const LEGACY_PLAN_HEADINGS = [
  "Relevant precedent and important differences",
  "What to reuse",
  "Required adaptations",
  "Lessons and risks",
  "Clarification questions",
  "Suggested next steps",
] as const;
export const PLAN_HEADINGS = [
  "Proposed outcome",
  "What to reuse and change",
  "Implementation steps",
  "Risks and limits",
  "Decisions to confirm",
] as const;
export type PlanItem = {
  kind: "fact" | "inference" | "recommendation" | "unknown";
  text: string;
  evidence: string[];
};
export type LegacyGeneratedPlan = {
  formatVersion?: never;
  kind: "reuse" | "clarification";
  sections: {
    heading: (typeof LEGACY_PLAN_HEADINGS)[number];
    items: PlanItem[];
  }[];
};
export type ActionablePlan = {
  formatVersion: 2;
  kind: "reuse" | "clarification";
  sections: {
    heading: (typeof PLAN_HEADINGS)[number];
    items: (PlanItem & { doneWhen: string })[];
  }[];
};
export type GeneratedPlan = LegacyGeneratedPlan | ActionablePlan;
export type ReusePlan = {
  request_evidence?: RequestEvidence[];
  id: string;
  conversation_id: string;
  title: string;
  status: "preparing" | "review" | "generating" | "ready" | "failed";
  failed_stage: "prepare" | "generate" | null;
  error_message: string | null;
  snapshot: PlanSnapshot;
  brief: PlanBrief | null;
  confirmed_request: PlanBrief | null;
  kind: "reuse" | "clarification";
  evidence: Evidence[];
  warnings: string[];
  generated: GeneratedPlan | null;
  generated_markdown: string | null;
  saved_markdown: string | null;
  saved_title: string | null;
  revision: number;
  saved_at: string | null;
  created_at: string;
  started_at: string;
};
export type PlanSummary = Pick<
  ReusePlan,
  | "id"
  | "conversation_id"
  | "title"
  | "status"
  | "kind"
  | "saved_at"
  | "created_at"
>;
