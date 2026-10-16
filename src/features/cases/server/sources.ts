import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { chunkPages, extractSourceStage } from "../extraction";
import type { SourceDocument } from "../types";
import { metadataField, validateFile, validateText } from "../validation";
import { checkDatabase, database } from "./db";
import { embedTexts } from "./embeddings";
import { ApiError, validId } from "./http";
import { accessibleCase, caseDetail } from "./repository";

export async function ownedSource(
  id: string,
  sessionId: string,
  writable = false,
) {
  const result = await database()
    .from("source_documents")
    .select("*")
    .eq("id", validId(id))
    .maybeSingle();
  checkDatabase(result.error);
  if (!result.data) throw new ApiError(404, "Source not found.");
  const record = await accessibleCase(result.data.case_id, sessionId);
  if (writable && record.is_seed)
    throw new ApiError(403, "Fictional sample cases are read-only.");
  return result.data;
}
export function sourceDatabaseError(error: { message: string } | null) {
  if (
    error &&
    /limit:|exceeds|backfill|Invalid pasted|No readable|reconciliation is busy/i.test(
      error.message,
    )
  )
    throw new ApiError(400, error.message);
  checkDatabase(error);
}
export async function createCaseShell(
  input: Record<string, unknown>,
  sessionId: string,
) {
  const id = validId(String(input.requestKey ?? ""));
  const fields = Object.fromEntries(
    ["title", "context", "outcome", "lessons"].map((name) => [
      name,
      metadataField(
        typeof input[name] === "string" ? input[name] : null,
        name,
        name === "title" ? 200 : 5000,
        name === "title",
      ),
    ]),
  );
  const result = await database()
    .from("cases")
    .upsert(
      { id, request_key: id, session_id: sessionId, ...fields },
      { onConflict: "id", ignoreDuplicates: true },
    );
  checkDatabase(result.error);
  return caseDetail(id, sessionId);
}
export async function reserveSource(
  caseId: string,
  input: Record<string, unknown>,
  sessionId: string,
) {
  await accessibleCase(caseId, sessionId).then((c) => {
    if (c.is_seed)
      throw new ApiError(403, "Fictional sample cases are read-only.");
  });
  const id = validId(String(input.requestKey ?? ""));
  const text = typeof input.text === "string" ? input.text : null;
  const title = metadataField(
    typeof input.title === "string" ? input.title : null,
    "Document title",
    200,
    true,
  );
  let format: string, size: number;
  if (text !== null) {
    validateText(text);
    format = "text";
    size = new TextEncoder().encode(text).length;
  } else {
    size = Number(input.size);
    if (!Number.isSafeInteger(size))
      throw new ApiError(400, "Invalid file size.");
    format = validateFile(title, size);
  }
  const result = await database().rpc("reserve_source", {
    p_case: validId(caseId),
    p_session: sessionId,
    p_id: id,
    p_title: title,
    p_format: format,
    p_bytes: size,
    p_text: text,
  });
  sourceDatabaseError(result.error);
  const source = result.data;
  if (source.status !== "uploading")
    return { sourceId: source.id, uploadUrl: null };
  const signed = await database()
    .storage.from("case-sources")
    .createSignedUploadUrl(source.storage_path, { upsert: false });
  checkDatabase(signed.error);
  return { sourceId: id, uploadUrl: signed.data?.signedUrl };
}
export async function originalBytes(source: {
  original_text: string | null;
  storage_path: string | null;
}) {
  if (source.original_text !== null)
    return new TextEncoder().encode(source.original_text);
  if (!source.storage_path)
    throw new ApiError(
      404,
      "Original source is unavailable. Select the file again.",
    );
  const file = await database()
    .storage.from("case-sources")
    .download(source.storage_path);
  if (file.error || !file.data)
    throw new ApiError(
      409,
      "The original upload did not finish. Select the file again to resume.",
    );
  return new Uint8Array(await file.data.arrayBuffer());
}
export async function completeSource(
  id: string,
  sessionId: string,
  analysisId?: string,
) {
  const source = await ownedSource(id, sessionId, true);
  const bytes = await originalBytes(source);
  if (
    bytes.length > 5_000_000 ||
    (source.byte_size !== null && bytes.length !== source.byte_size)
  ) {
    if (source.storage_path)
      checkDatabase(
        (
          await database()
            .storage.from("case-sources")
            .remove([source.storage_path])
        ).error,
      );
    throw new ApiError(
      400,
      "Stored file size differs from its reservation. Select the original file again.",
    );
  }
  checkDatabase(
    (
      await database()
        .from("source_documents")
        .update({
          status: "queued",
          byte_size: bytes.length,
          upload_expires_at: null,
        })
        .eq("id", id)
        .eq("status", "uploading")
    ).error,
  );
  if (analysisId) {
    const hash = createHash("sha256")
      .update(source.format)
      .update("\0")
      .update(bytes)
      .digest("hex");
    const reading = await database()
      .from("case_ai_readings")
      .select("id")
      .eq("id", validId(analysisId))
      .eq("session_id", sessionId)
      .eq("source_hash", hash)
      .eq("status", "ready")
      .maybeSingle();
    checkDatabase(reading.error);
    if (!reading.data)
      throw new ApiError(
        400,
        "AI reading does not match this source and session.",
      );
    checkDatabase(
      (
        await database()
          .from("case_ai_reviews")
          .upsert(
            { case_id: source.case_id, source_id: id, reading_id: analysisId },
            { onConflict: "case_id", ignoreDuplicates: true },
          )
      ).error,
    );
  }
  return { sourceId: id };
}

// Each call advances one checkpoint. A browser or administrative command drives the loop.
export async function processSource(
  id: string,
  sessionId: string | null,
  retry = false,
  embedder: typeof embedTexts = embedTexts,
) {
  const db = database();
  if (sessionId) await ownedSource(id, sessionId, true);
  const token = randomUUID();
  const claim = await db.rpc("claim_source", {
    p_id: id,
    p_session: sessionId,
    p_token: token,
    p_retry: retry,
  });
  checkDatabase(claim.error);
  if (!claim.data) return;
  const read = await db
    .from("source_documents")
    .select("*")
    .eq("id", id)
    .single();
  checkDatabase(read.error);
  const source = read.data;
  try {
    if (source.status !== "ready") {
      const bytes = await originalBytes(source);
      const extracted = await extractSourceStage(
        bytes,
        source.format,
        source.pages,
        source.warnings,
      );
      const saved = await db.rpc("save_source_stage", {
        p_id: id,
        p_token: token,
        p_pages: extracted.pages,
        p_warnings: extracted.warnings,
        p_cursor: extracted.pages.length,
        p_count: extracted.pageCount,
        p_complete: extracted.complete,
        p_chunks: extracted.complete
          ? chunkPages(extracted.pages, source.format)
          : [],
      });
      sourceDatabaseError(saved.error);
    } else {
      const chunks = await db
        .from("source_chunks")
        .select("id,text")
        .eq("source_id", id)
        .is("embedding", null)
        .order("ordinal")
        .limit(16);
      checkDatabase(chunks.error);
      const rows = chunks.data ?? [];
      const vectors = rows.length
        ? await embedder(
            rows.map((c) => c.text),
            sessionId,
          )
        : [];
      checkDatabase(
        (
          await db.rpc("save_source_embeddings", {
            p_id: id,
            p_token: token,
            p_vectors: rows.map((c, i) => ({
              id: c.id,
              embedding: vectors[i],
            })),
          })
        ).error,
      );
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Processing could not finish. Retry this document.";
    checkDatabase(
      (
        await db
          .from("source_documents")
          .update(
            source.status === "ready"
              ? {
                  indexing_status: "failed",
                  indexing_error: message,
                  processing_token: null,
                }
              : {
                  status: "failed",
                  error_message: message,
                  processing_token: null,
                },
          )
          .eq("id", id)
          .eq("processing_token", token)
      ).error,
    );
    checkDatabase(
      (await db.rpc("refresh_case_status", { p_id: source.case_id })).error,
    );
  }
}

export async function sourceText(
  id: string,
  sessionId: string,
  page: number,
  start: number,
) {
  const source = await ownedSource(id, sessionId);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(start) ||
    start < 0
  )
    throw new ApiError(400, "Invalid source location.");
  const pages = source.pages as SourceDocument["pages"];
  const text = pages.find((p) => p.number === page)?.text ?? "";
  return {
    text: text.slice(start, start + 10000),
    page,
    start,
    next: start + 10000 < text.length ? start + 10000 : null,
    pageCount: pages.length,
  };
}

export async function reconcileUploads(caseId: string, sessionId: string) {
  const record = await accessibleCase(caseId, sessionId);
  if (record.is_seed) return;
  const db = database();
  const expired = await db
    .from("source_documents")
    .select("id,storage_path,upload_expires_at")
    .eq("case_id", caseId)
    .eq("status", "uploading")
    .lt("upload_expires_at", new Date().toISOString());
  checkDatabase(expired.error);
  for (const source of expired.data ?? []) {
    const token = randomUUID();
    const claimed = await db
      .from("source_documents")
      .update({
        processing_token: token,
        processing_started_at: new Date().toISOString(),
      })
      .eq("id", source.id)
      .eq("status", "uploading")
      .eq("upload_expires_at", source.upload_expires_at)
      .or(
        `processing_token.is.null,processing_started_at.lt.${new Date(Date.now() - 120000).toISOString()}`,
      )
      .select("id")
      .maybeSingle();
    checkDatabase(claimed.error);
    if (!claimed.data) continue;
    const info = await db.storage
      .from("case-sources")
      .info(source.storage_path);
    if (info.data) {
      await completeSource(source.id, sessionId);
      checkDatabase(
        (
          await db
            .from("source_documents")
            .update({ processing_token: null })
            .eq("id", source.id)
            .eq("processing_token", token)
        ).error,
      );
    } else if (info.error && String(info.error.statusCode) === "404") {
      // The signed capability has expired; it can no longer recreate this object.
      checkDatabase(
        (await db.storage.from("case-sources").remove([source.storage_path]))
          .error,
      );
      checkDatabase(
        (
          await db
            .from("source_documents")
            .delete()
            .eq("id", source.id)
            .eq("status", "uploading")
            .eq("processing_token", token)
        ).error,
      );
    } else checkDatabase(info.error);
  }
  checkDatabase((await db.rpc("refresh_case_status", { p_id: caseId })).error);
}
