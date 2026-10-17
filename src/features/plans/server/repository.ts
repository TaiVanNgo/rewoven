import "server-only";
import { checkDatabase, database } from "@/features/cases/server/db";
import { ApiError, validId } from "@/features/cases/server/http";
import { queryDetail } from "@/features/queries/server/repository";
import { validateMarkdown } from "../content";
import type { PlanSnapshot, PlanSummary, ReusePlan } from "../types";

const fields =
  "id,conversation_id,title,status,failed_stage,error_message,snapshot,brief,confirmed_request,kind,evidence,warnings,generated,generated_markdown,saved_markdown,saved_title,revision,saved_at,created_at,started_at";
export async function activePlanSession(sessionId: string) {
  const result = await database()
    .from("demo_sessions")
    .select("id")
    .eq("id", sessionId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  checkDatabase(result.error);
  if (!result.data)
    throw new ApiError(
      401,
      "Your demo session has expired. Start a new session to continue.",
    );
}
export async function planDetail(
  id: string,
  sessionId: string,
): Promise<ReusePlan> {
  await activePlanSession(sessionId);
  const result = await database()
    .from("reuse_plans")
    .select(fields)
    .eq("id", validId(id))
    .eq("session_id", sessionId)
    .maybeSingle();
  checkDatabase(result.error);
  if (!result.data)
    throw new ApiError(404, "Plan not found in this demo session.");
  const plan = result.data as ReusePlan;
  if (plan.evidence.length) {
    const sources = await database()
      .from("source_documents")
      .select("id,version,status")
      .in("id", [...new Set(plan.evidence.map((e) => e.source_id))]);
    checkDatabase(sources.error);
    for (const e of plan.evidence)
      e.stale = !sources.data?.some(
        (s) =>
          s.id === e.source_id &&
          s.version === e.version &&
          s.status === "ready",
      );
    if (plan.evidence.some((e) => e.stale))
      plan.warnings = [
        ...plan.warnings,
        "Some sources changed or are unavailable. This plan retains its original excerpts; review current evidence before reuse.",
      ];
  }
  return plan;
}
export async function listPlans(
  sessionId: string,
  conversationId?: string,
): Promise<PlanSummary[]> {
  await activePlanSession(sessionId);
  if (conversationId) await queryDetail(validId(conversationId), sessionId);
  let query = database()
    .from("reuse_plans")
    .select(
      "id,conversation_id,title,saved_title,status,kind,saved_at,created_at",
    )
    .eq("session_id", sessionId);
  query = conversationId
    ? query
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
    : query.not("saved_at", "is", null).order("saved_at", { ascending: false });
  const result = await query;
  checkDatabase(result.error);
  return (result.data ?? []).map(({ saved_title, ...plan }) => ({
    ...plan,
    title: saved_title ?? plan.title,
  })) as PlanSummary[];
}
export async function createPlan(
  conversationId: string,
  input: Record<string, unknown>,
  sessionId: string,
) {
  const id = validId(String(input.requestKey ?? ""));
  if (
    !Number.isSafeInteger(input.contextRevision) ||
    Number(input.contextRevision) < 0
  )
    throw new ApiError(400, "Reopen the chat before drafting a plan.");
  const conversation = await queryDetail(conversationId, sessionId);
  let count = 0;
  const messages: string[] = [];
  for (const turn of [...conversation.turns].reverse().slice(0, 8)) {
    if (count + turn.message.length > 24000) break;
    messages.unshift(turn.message);
    count += turn.message.length;
  }
  const snapshot: PlanSnapshot = {
    context:
      conversation.chat_context ??
      (conversation.focused_case_id
        ? { mode: "selected", caseIds: [conversation.focused_case_id] }
        : { mode: "library", caseIds: [] }),
    originalRequest: conversation.request,
    messages,
    throughTurnId: conversation.turns.at(-1)?.id ?? null,
    warnings:
      messages.length < conversation.turns.length
        ? [
            "The request summary covers at most eight recent user messages and 24,000 characters. Add older requirements before confirming.",
          ]
        : [],
  };
  const result = await database().rpc("create_reuse_plan", {
    p_session: sessionId,
    p_conversation: conversationId,
    p_id: id,
    p_revision: input.contextRevision,
    p_snapshot: snapshot,
  });
  checkDatabase(result.error);
  if (!["created", "cached"].includes(result.data))
    throw new ApiError(
      result.data === "missing" ? 404 : 409,
      "The chat changed or Wren is answering. Reopen the chat and try again.",
    );
  return planDetail(id, sessionId);
}
export async function savePlan(
  id: string,
  input: Record<string, unknown>,
  sessionId: string,
) {
  const plan = await planDetail(id, sessionId);
  if (
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.length > 120 ||
    !Number.isSafeInteger(input.revision) ||
    Number(input.revision) < 0
  )
    throw new ApiError(
      400,
      "Enter a title of 1–120 characters and a save revision.",
    );
  let markdown: string;
  try {
    markdown = validateMarkdown(input.markdown, plan.evidence);
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
  const result = await database().rpc("save_reuse_plan", {
    p_session: sessionId,
    p_plan: id,
    p_revision: input.revision,
    p_title: input.title.trim(),
    p_markdown: markdown,
  });
  checkDatabase(result.error);
  if (!result.data)
    throw new ApiError(
      409,
      "This plan changed in another tab or is not ready. Your edits are preserved; open the latest saved version in another tab to compare.",
    );
  return planDetail(id, sessionId);
}
