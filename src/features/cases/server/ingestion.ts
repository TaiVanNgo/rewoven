import "server-only";
import { MAX_FILE_BYTES } from "../types";
import { metadataField } from "../validation";
import { checkDatabase, database } from "./db";
import { ApiError, validId } from "./http";
import { accessibleCase, caseDetail } from "./repository";
import { sourceInput } from "./source-input";
import { processSource } from "./sources";

export async function boundedFormData(request: Request) {
  const limit = MAX_FILE_BYTES + 100_000;
  if (Number(request.headers.get("content-length")) > limit)
    throw new ApiError(
      413,
      "Upload exceeds 5 MB plus form fields. Choose a smaller file.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Add case details and a source.");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(
          413,
          "Upload exceeds 5 MB plus form fields. Choose a smaller file.",
        );
      }
      parts.push(value);
    }
    return await new Response(Buffer.concat(parts), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      "The upload could not be read. Select the file again.",
    );
  } finally {
    reader.releaseLock();
  }
}
export async function createCase(form: FormData, sessionId: string) {
  const id = validId(
    metadataField(form.get("requestKey"), "Request identifier", 36, true),
  );
  const input = {
    title: metadataField(form.get("title"), "Case title", 200, true),
    context: metadataField(form.get("context"), "Context", 5000),
    outcome: metadataField(form.get("outcome"), "Outcome", 5000),
    lessons: metadataField(form.get("lessons"), "Lessons", 5000),
  };
  const source = await sourceInput(form);
  const { format, title, originalText, bytes } = source;
  const storagePath =
    originalText === null ? `${sessionId}/${id}/source-v1.${format}` : null;
  const db = database();
  const analysisId = metadataField(
    form.get("analysisId"),
    "AI reading identifier",
    36,
  );
  if (analysisId) {
    const reading = await db
      .from("case_ai_readings")
      .select("id")
      .eq("id", validId(analysisId))
      .eq("session_id", sessionId)
      .eq("source_hash", source.hash)
      .eq("status", "ready")
      .maybeSingle();
    checkDatabase(reading.error);
    if (!reading.data)
      throw new ApiError(
        400,
        "The AI reading does not match this session and source. Read the current source again, or add the case manually.",
      );
  }
  const reserved = await db.rpc("reserve_case", {
    p_id: id,
    p_session: sessionId,
    p_input: input,
    p_source: {
      title,
      format,
      original_text: originalText,
      storage_path: storagePath,
      ai_reading_id: analysisId || null,
      source_hash: source.hash,
    },
  });
  checkDatabase(reserved.error);
  if (!reserved.data) return caseDetail(id, sessionId);
  checkDatabase(
    (
      await db
        .from("source_documents")
        .update({ byte_size: bytes.length })
        .eq("id", id)
    ).error,
  );
  if (bytes && storagePath) {
    const upload = await db.storage
      .from("case-sources")
      .upload(storagePath, bytes, {
        contentType:
          format === "pdf" ? "application/pdf" : "text/plain; charset=utf-8",
        upsert: false,
      });
    if (upload.error) {
      checkDatabase(
        (
          await db
            .from("source_documents")
            .update({
              status: "failed",
              error_message:
                "The original upload did not finish. Add the case again with the file, or paste its text.",
            })
            .eq("id", id)
            .eq("case_id", id)
        ).error,
      );
      checkDatabase((await db.rpc("refresh_case_status", { p_id: id })).error);
      return caseDetail(id, sessionId);
    }
  }
  return processCase(id, sessionId);
}
export async function processCase(id: string, sessionId: string) {
  const record = await accessibleCase(id, sessionId);
  if (record.is_seed)
    throw new ApiError(403, "Fictional sample cases are read-only.");
  const result = await database()
    .from("source_documents")
    .select("id,status")
    .eq("case_id", id)
    .order("created_at");
  checkDatabase(result.error);
  // The compatibility retry must remain bounded even for a case with fifty sources.
  checkDatabase(
    (
      await database()
        .from("source_documents")
        .update({ status: "queued", error_message: null })
        .eq("case_id", id)
        .eq("status", "failed")
        .is("processing_token", null)
    ).error,
  );
  const next = (result.data ?? []).find(
    (source) => source.status !== "ready" && source.status !== "uploading",
  );
  if (next) await processSource(next.id, sessionId, true);
  return caseDetail(id, sessionId);
}
