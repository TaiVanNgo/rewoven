import "server-only";
import { randomUUID } from "node:crypto";
import { chunkPages, extractSourceStage } from "@/features/cases/extraction";
import { checkDatabase, database } from "@/features/cases/server/db";
import { ApiError, validId } from "@/features/cases/server/http";
import {
  sourceContext,
  sourceLocation,
} from "@/features/citations/source-context";
import { queryAIConfig, queryModel } from "@/features/queries/server/openai";
import {
  documentEvidence,
  fileManifest,
  mergeRequestNodes,
  requestFindings,
} from "../content";
import type {
  QueryFile,
  RequestDocumentContext,
  RequestEvidence,
  StoredQueryFile,
} from "../types";

const publicFields =
  "id,conversation_id,title,format,version,byte_size,char_count,status,enabled,first_turn_id,warnings,error_message,cursor,total";
export function documentError(error: { message: string } | null) {
  if (error?.message.startsWith("Document:"))
    throw new ApiError(409, error.message.slice(10).trim());
  checkDatabase(error);
}
export async function authorizeFileChat(id: string, sessionId: string) {
  const session = await database()
    .from("demo_sessions")
    .select("id")
    .eq("id", sessionId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  checkDatabase(session.error);
  if (!session.data)
    throw new ApiError(401, "Your demo session expired. Start a new chat.");
  const query = await database()
    .from("query_conversations")
    .select("id")
    .eq("id", validId(id))
    .eq("session_id", sessionId)
    .maybeSingle();
  checkDatabase(query.error);
  if (!query.data) throw new ApiError(404, "Chat not found in this session.");
}
export async function listQueryFiles(
  conversationId: string,
  sessionId: string,
): Promise<QueryFile[]> {
  const result = await database()
    .from("query_files")
    .select(publicFields)
    .eq("conversation_id", conversationId)
    .eq("session_id", sessionId)
    .order("created_at")
    .order("id");
  checkDatabase(result.error);
  return result.data as QueryFile[];
}
export async function ownedQueryFile(
  id: string,
  sessionId: string,
): Promise<StoredQueryFile> {
  const result = await database()
    .from("query_files")
    .select("*")
    .eq("id", validId(id))
    .eq("session_id", sessionId)
    .maybeSingle();
  checkDatabase(result.error);
  if (!result.data)
    throw new ApiError(404, "Request document not found in this session.");
  await authorizeFileChat(result.data.conversation_id, sessionId);
  return result.data as StoredQueryFile;
}
export async function reserveQueryFiles(
  conversationId: string,
  value: unknown,
  sessionId: string,
) {
  let files: ReturnType<typeof fileManifest>;
  try {
    files = fileManifest(value);
  } catch (error) {
    throw new ApiError(400, (error as Error).message);
  }
  const reserved = await database().rpc("reserve_query_files", {
    p_session: sessionId,
    p_conversation: validId(conversationId),
    p_files: files,
  });
  documentError(reserved.error);
  return listQueryFiles(conversationId, sessionId);
}
export async function queryFileUpload(id: string, sessionId: string) {
  const file = await ownedQueryFile(id, sessionId);
  if (file.status !== "uploading") return { uploadUrl: null };
  const result = await database()
    .storage.from("query-files")
    .createSignedUploadUrl(file.storage_path, { upsert: false });
  checkDatabase(result.error);
  return { uploadUrl: result.data?.signedUrl ?? null };
}
export async function queryFileBytes(file: StoredQueryFile) {
  const stored = await database()
    .storage.from("query-files")
    .download(file.storage_path);
  if (stored.error || !stored.data)
    throw new ApiError(
      409,
      "The original upload is missing. Select this file again, or exclude it.",
    );
  const bytes = new Uint8Array(await stored.data.arrayBuffer());
  if (bytes.length !== file.byte_size || bytes.length > 5000000)
    throw new ApiError(
      400,
      "Stored file size differs from its reservation. Exclude it and upload the original again.",
    );
  return bytes;
}
export async function completeQueryFile(id: string, sessionId: string) {
  const file = await ownedQueryFile(id, sessionId);
  if (file.status === "uploading") {
    await queryFileBytes(file);
    checkDatabase(
      (
        await database()
          .from("query_files")
          .update({ status: "extracting" })
          .eq("id", id)
          .eq("status", "uploading")
      ).error,
    );
  }
}
export async function toggleQueryFile(
  id: string,
  input: Record<string, unknown>,
  sessionId: string,
) {
  await ownedQueryFile(id, sessionId);
  if (
    typeof input.enabled !== "boolean" ||
    !Number.isSafeInteger(input.contextRevision)
  )
    throw new ApiError(
      400,
      "Choose a file and reopen the chat before changing its context.",
    );
  documentError(
    (
      await database().rpc("toggle_query_file", {
        p_session: sessionId,
        p_id: id,
        p_enabled: input.enabled,
        p_revision: input.contextRevision,
      })
    ).error,
  );
}
export async function processQueryFile(
  id: string,
  sessionId: string,
  retry = false,
  dependencies: { model?: typeof queryModel } = {},
) {
  let file = await ownedQueryFile(id, sessionId);
  if (file.status === "ready") return;
  if (file.status === "uploading")
    throw new ApiError(
      409,
      "Upload this file again, or exclude it before sending.",
    );
  const token = randomUUID();
  const db = database();
  const claim = await db.rpc("claim_query_file", {
    p_session: sessionId,
    p_id: id,
    p_token: token,
    p_retry: retry,
  });
  documentError(claim.error);
  if (!claim.data)
    throw new ApiError(
      409,
      "This file is processing elsewhere. Reopen the chat to check progress, or retry after two minutes.",
    );
  async function save(patch: Record<string, unknown>) {
    const result = await db.rpc("save_query_file_stage", {
      p_session: sessionId,
      p_id: id,
      p_token: token,
      p_patch: patch,
    });
    documentError(result.error);
    if (!result.data)
      throw new ApiError(
        409,
        "This document was resumed elsewhere. Reopen the chat.",
      );
  }
  try {
    file = await ownedQueryFile(id, sessionId);
    if (!file.total) {
      const extracted = await extractSourceStage(
        await queryFileBytes(file),
        file.format,
        file.pages,
        file.warnings,
      );
      const count = extracted.pages.map((p) => p.text).join("\n\n").length;
      await save({
        pages: extracted.pages,
        warnings: extracted.warnings,
        char_count: count,
        total: extracted.complete
          ? chunkPages(extracted.pages, file.format).length
          : 0,
        status: extracted.complete ? "reading" : "extracting",
      });
      return;
    }
    const evidence = documentEvidence(file);
    const indexes = mergeRequestNodes(
      file.nodes,
      file.cursor >= evidence.length,
    );
    if (!indexes.length && file.cursor >= evidence.length) {
      await save({ status: "ready" });
      return;
    }
    const config = queryAIConfig();
    if (!config)
      throw new ApiError(
        503,
        "Configure OPENAI_API_KEY to read request documents. Your uploads are preserved.",
      );
    function limit(name: string, fallback: number) {
      if (process.env.NODE_ENV === "development") return null;
      const value = Number(process.env[name] ?? fallback);
      if (!Number.isSafeInteger(value) || value < 0)
        throw new ApiError(503, "Request-file usage limits are misconfigured.");
      return value;
    }
    const reserved = await db.rpc("reserve_query_file_ai", {
      p_session: sessionId,
      p_file: id,
      p_token: token,
      p_session_limit: limit("AI_QUERY_FILE_SESSION_LIMIT", 50),
      p_daily_limit: limit("AI_QUERY_FILE_DAILY_LIMIT", 100),
    });
    documentError(reserved.error);
    if (!reserved.data)
      throw new ApiError(
        429,
        "Document-reading limit reached. Completed stages are saved; retry when capacity is available.",
      );
    const batch = evidence.slice(file.cursor, file.cursor + 20);
    const merging = indexes.map((i) => file.nodes[i]);
    const allowed = new Set(
      indexes.length
        ? merging.flatMap((n) => n.findings.flatMap((f) => f.evidence))
        : batch.map((e) => e.id),
    );
    const findings = requestFindings(
      await (dependencies.model ?? queryModel)(
        "request_reading",
        indexes.length
          ? { title: file.title, findings: merging.flatMap((n) => n.findings) }
          : { title: file.title, excerpts: batch },
        config,
      ),
      allowed,
    );
    const nodes = indexes.length
      ? [
          ...file.nodes.filter((_, i) => !indexes.includes(i)),
          { level: Math.max(...merging.map((n) => n.level)) + 1, findings },
        ]
      : [...file.nodes, { level: 0, findings }];
    const cursor = indexes.length ? file.cursor : file.cursor + batch.length;
    await save({
      nodes,
      cursor,
      status:
        cursor >= evidence.length && nodes.length === 1 ? "ready" : "reading",
    });
  } catch (error) {
    await save({
      status: "failed",
      error_message:
        error instanceof Error
          ? error.message
          : "Could not read this document. Retry it.",
    });
  }
}
export async function requestDocumentContext(
  ids: string[],
  sessionId: string,
  question: string,
): Promise<RequestDocumentContext> {
  const documents: RequestDocumentContext["documents"] = [];
  const queues: RequestEvidence[][] = [];
  const terms = new Set(
    question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [],
  );
  for (const id of ids) {
    const file = await ownedQueryFile(id, sessionId);
    if (file.status !== "ready" || file.warnings.length)
      throw new ApiError(
        409,
        "Request-document reading is incomplete. Retry or exclude it before analysis.",
      );
    const findings = file.nodes.flatMap((n) => n.findings);
    documents.push({ id, title: file.title, version: file.version, findings });
    const cited = new Set(findings.flatMap((f) => f.evidence));
    const scored = documentEvidence(file).map((e, ordinal) => ({
      e,
      ordinal,
      score: [...terms].reduce(
        (score, t) => score + (e.text.toLowerCase().includes(t) ? 1 : 0),
        0,
      ),
    }));
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        Number(cited.has(b.e.id)) - Number(cited.has(a.e.id)) ||
        a.ordinal - b.ordinal,
    );
    queues.push(scored.map((s) => s.e));
  }
  const evidence: RequestEvidence[] = [];
  let chars = 0;
  while (queues.some((q) => q.length) && evidence.length < 30) {
    for (const queue of queues) {
      const item = queue.shift();
      if (item && evidence.length < 30 && chars + item.text.length <= 60000) {
        evidence.push(item);
        chars += item.text.length;
      }
    }
  }
  return { documents, evidence };
}
export async function queryFilePreview(
  id: string,
  sessionId: string,
  params: URLSearchParams,
) {
  const file = await ownedQueryFile(id, sessionId);
  const location = sourceLocation(params);
  if (location.version !== null && location.version !== file.version)
    throw new ApiError(409, "Saved request-document version is unavailable.");
  const page = file.pages.find((p) => p.number === location.page);
  if (!page)
    throw new ApiError(404, "This document page is not available yet.");
  const signed =
    file.format === "pdf"
      ? await database()
          .storage.from("query-files")
          .createSignedUrl(file.storage_path, 60)
      : null;
  return {
    source: {
      id,
      title: file.title,
      format: file.format,
      version: file.version,
      pageCount: file.pages.length,
    },
    page: location.page,
    ...sourceContext(page.text, location),
    pdfUrl: signed?.data?.signedUrl ?? null,
  };
}
