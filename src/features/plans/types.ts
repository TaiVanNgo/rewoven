import type { ChatContext, Evidence } from "@/features/queries/types";
import type { RequestDraft } from "@/features/requests/request-draft";

export type PlanBrief = RequestDraft & { title: string; questions: string };
export type PlanSnapshot = {
  context: ChatContext;
  originalRequest: RequestDraft;
  messages: string[];
  throughTurnId: string | null;
  warnings: string[];
};
export const PLAN_HEADINGS = [
  "Relevant precedent and important differences",
  "What to reuse",
  "Required adaptations",
  "Lessons and risks",
  "Clarification questions",
  "Suggested next steps",
] as const;
export type GeneratedPlan = {
  kind: "reuse" | "clarification";
  sections: {
    heading: (typeof PLAN_HEADINGS)[number];
    items: {
      kind: "fact" | "inference" | "recommendation" | "unknown";
      text: string;
      evidence: string[];
    }[];
  }[];
};
export type ReusePlan = {
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
