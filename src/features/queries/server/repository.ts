import { fileManifest } from "@/features/query-files/content";
import {
  documentError,
  listQueryFiles,
} from "@/features/query-files/server/repository";
import { FILE_ONLY_MESSAGE } from "@/features/query-files/types";
import "server-only";
import { checkDatabase, database } from "@/features/cases/server/db";
import { ApiError, validId } from "@/features/cases/server/http";
import { accessibleCase } from "@/features/cases/server/repository";
import { chatContextInput } from "../assistant";
import type {
  ChatContext,
  QueryConversation,
  QuerySummary,
  QueryTurn,
} from "../types";
import { requestInput } from "../validation";

const turnFields =
  "id,ordinal,message,scope,focused_case_id,status,work,answer,error_message,started_at,context_snapshot,phase,request_file_ids,new_file_ids";
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
    .select(
      "id,title,request,focused_case_id,updated_at,assistant,chat_context,context_revision",
    )
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
  const context = result.data.chat_context as ChatContext;
  const selected = context.caseIds.length
    ? await db
        .from("cases")
        .select("id,title,is_seed")
        .in("id", context.caseIds)
        .or(`is_seed.eq.true,session_id.eq.${sessionId}`)
    : { data: [], error: null };
  checkDatabase(selected.error);
  return {
    ...result.data,
    turns: records,
    files: await listQueryFiles(id, sessionId),
    selected_cases: selected.data ?? [],
  };
}
export async function createQuery(
  input: Record<string, unknown>,
  sessionId: string,
) {
  await activeSession(sessionId);
  const id = validId(String(input.requestKey ?? ""));
  let files: ReturnType<typeof fileManifest>;
  try {
    files = fileManifest(input.files ?? []);
  } catch (error) {
    throw new ApiError(400, (error as Error).message);
  }
  const draft = requestInput({
    ...input,
    request:
      files.length && !String(input.request ?? "").trim()
        ? FILE_ONLY_MESSAGE
        : input.request,
  });
  const caseId = input.caseId == null ? null : validId(String(input.caseId));
  if (caseId) await accessibleCase(caseId, sessionId);
  const context =
    input.assistant === true
      ? chatContextInput(input.chatContext ?? { mode: "library", caseIds: [] })
      : caseId
        ? { mode: "selected" as const, caseIds: [caseId] }
        : { mode: "library" as const, caseIds: [] };
  if (input.assistant === true) await validateChatCases(context, sessionId);
  if (files.length) {
    const created = await database().rpc("create_query_file_chat", {
      p_session: sessionId,
      p_id: id,
      p_request: draft,
      p_context: context,
      p_files: files,
    });
    documentError(created.error);
    return queryDetail(id, sessionId);
  }
  const result = await database()
    .from("query_conversations")
    .upsert(
      {
        id,
        session_id: sessionId,
        title: draft.request.slice(0, 120),
        request: draft,
        focused_case_id: caseId,
        assistant: input.assistant === true,
        chat_context: context,
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
    record.focused_case_id !== caseId ||
    record.assistant !== (input.assistant === true)
  )
    throw new ApiError(
      409,
      "This query identifier is already in use. Start a new query.",
    );
  return record;
}

export async function validateChatCases(
  context: ChatContext,
  sessionId: string,
) {
  await Promise.all(
    context.caseIds.map(async (id) => {
      await accessibleCase(id, sessionId);
      const ready = await database()
        .from("source_chunks")
        .select("id,source_documents!inner(status,case_id)")
        .eq("source_documents.case_id", id)
        .eq("source_documents.status", "ready")
        .limit(1);
      checkDatabase(ready.error);
      if (!ready.data?.length)
        throw new ApiError(
          409,
          "This case has no readable sources yet. Finish processing it in Case library first.",
        );
    }),
  );
}
export async function updateChatContext(
  id: string,
  input: Record<string, unknown>,
  sessionId: string,
) {
  await queryDetail(id, sessionId);
  const context = chatContextInput(input.chatContext);
  if (
    !Number.isSafeInteger(input.contextRevision) ||
    Number(input.contextRevision) < 0
  )
    throw new ApiError(400, "A context revision is required.");
  await validateChatCases(context, sessionId);
  const result = await database().rpc("update_query_context", {
    p_session: sessionId,
    p_conversation: id,
    p_revision: input.contextRevision,
    p_context: context,
  });
  checkDatabase(result.error);
  if (!result.data)
    throw new ApiError(
      409,
      "The case selection changed or Wren is answering. Reopen the chat and try again.",
    );
  return queryDetail(id, sessionId);
}
