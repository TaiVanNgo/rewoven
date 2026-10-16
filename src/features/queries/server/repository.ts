import "server-only";
import { checkDatabase, database } from "@/features/cases/server/db";
import { ApiError, validId } from "@/features/cases/server/http";
import { accessibleCase } from "@/features/cases/server/repository";
import type { QueryConversation, QuerySummary, QueryTurn } from "../types";
import { requestInput } from "../validation";

const turnFields =
  "id,ordinal,message,scope,focused_case_id,status,work,answer,error_message,started_at";
async function activeSession(sessionId: string) {
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
      "Your demo session has expired. Start a new request to begin another session.",
    );
}
export async function listQueries(sessionId: string): Promise<QuerySummary[]> {
  await activeSession(sessionId);
  const result = await database()
    .from("query_conversations")
    .select("id,title,updated_at")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });
  checkDatabase(result.error);
  return result.data ?? [];
}
export async function queryDetail(
  id: string,
  sessionId: string,
): Promise<QueryConversation> {
  await activeSession(sessionId);
  const db = database();
  const result = await db
    .from("query_conversations")
    .select("id,title,request,focused_case_id,updated_at")
    .eq("id", validId(id))
    .eq("session_id", sessionId)
    .maybeSingle();
  checkDatabase(result.error);
  if (!result.data)
    throw new ApiError(404, "Query not found in this demo session.");
  const turns = await db
    .from("query_turns")
    .select(turnFields)
    .eq("conversation_id", id)
    .order("ordinal");
  checkDatabase(turns.error);
  const records = (turns.data ?? []) as QueryTurn[];
  const sourceIds = [
    ...new Set(
      records.flatMap(
        (turn) => turn.work?.evidence.map((item) => item.source_id) ?? [],
      ),
    ),
  ];
  if (sourceIds.length) {
    const sources = await db
      .from("source_documents")
      .select("id,version,status")
      .in("id", sourceIds);
    checkDatabase(sources.error);
    for (const turn of records)
      if (turn.work) {
        for (const item of turn.work.evidence)
          item.stale = !sources.data?.some(
            (source) =>
              source.id === item.source_id &&
              source.version === item.version &&
              source.status === "ready",
          );
        if (turn.work.evidence.some((item) => item.stale))
          turn.work.retrieval.warnings.push(
            "Some sources changed or are no longer Ready. This saved answer retains its original excerpts; inspect the current case before reusing it.",
          );
      }
  }
  return { ...result.data, turns: records };
}
export async function createQuery(
  input: Record<string, unknown>,
  sessionId: string,
) {
  await activeSession(sessionId);
  const id = validId(String(input.requestKey ?? ""));
  const draft = requestInput(input);
  const caseId = input.caseId == null ? null : validId(String(input.caseId));
  if (caseId) await accessibleCase(caseId, sessionId);
  const result = await database()
    .from("query_conversations")
    .upsert(
      {
        id,
        session_id: sessionId,
        title: draft.request.slice(0, 120),
        request: draft,
        focused_case_id: caseId,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  checkDatabase(result.error);
  const record = await queryDetail(id, sessionId);
  if (
    record.request.request !== draft.request ||
    record.request.deadline !== draft.deadline ||
    record.request.technology !== draft.technology ||
    record.request.capabilities !== draft.capabilities ||
    record.focused_case_id !== caseId
  )
    throw new ApiError(
      409,
      "This query identifier is already in use. Start a new query.",
    );
  return record;
}
