import "server-only";
import { randomUUID } from "node:crypto";
import { chunkPages, extractSource } from "../extraction";
import { MAX_FILE_BYTES, type SourceFormat } from "../types";
import {
  InputError,
  metadataField,
  validateFile,
  validateText,
} from "../validation";
import { checkDatabase, database } from "./db";
import { ApiError, validId } from "./http";
import { accessibleCase, caseDetail } from "./repository";

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
  const mode = form.get("mode");
  if (mode !== "text" && mode !== "file")
    throw new InputError("Choose pasted text or a source file.");
  let format: SourceFormat = "text";
  let title = "Pasted source.txt";
  let originalText: string | null = null;
  let bytes: Uint8Array | undefined;
  if (mode === "text") {
    const value = form.get("text");
    if (typeof value !== "string")
      throw new InputError("Paste the original source text.");
    validateText(value);
    originalText = value;
  } else {
    const file = form.get("file");
    if (!(file instanceof File)) throw new InputError("Choose a source file.");
    format = validateFile(file.name, file.size);
    title = file.name.slice(0, 200);
    bytes = new Uint8Array(await file.arrayBuffer());
  }
  const storagePath =
    mode === "file" ? `${sessionId}/${id}/source-v1.${format}` : null;
  const db = database();
  const reserved = await db.rpc("reserve_case", {
    p_id: id,
    p_session: sessionId,
    p_input: input,
    p_source: {
      title,
      format,
      original_text: originalText,
      storage_path: storagePath,
    },
  });
  checkDatabase(reserved.error);
  if (!reserved.data) return caseDetail(id, sessionId);
  if (bytes && storagePath) {
    const upload = await db.storage
      .from("case-sources")
      .upload(storagePath, bytes, {
        contentType:
          format === "pdf" ? "application/pdf" : "text/plain; charset=utf-8",
        upsert: false,
      });
    if (upload.error) {
      await db
        .from("cases")
        .update({
          status: "failed",
          error_message:
            "The original upload did not finish. Add the case again with the file, or paste its text.",
        })
        .eq("id", id)
        .eq("session_id", sessionId);
      return caseDetail(id, sessionId);
    }
  }
  return processCase(id, sessionId);
}
export async function processCase(id: string, sessionId: string) {
  const record = await accessibleCase(id, sessionId);
  if (record.is_seed)
    throw new ApiError(403, "Fictional sample cases are read-only.");
  const db = database();
  const token = randomUUID();
  const claim = await db.rpc("claim_case", {
    p_id: id,
    p_session: sessionId,
    p_token: token,
  });
  checkDatabase(claim.error);
  if (!claim.data) return caseDetail(id, sessionId);
  try {
    const source = await db
      .from("source_documents")
      .select("id,format,original_text,storage_path")
      .eq("case_id", id)
      .single();
    checkDatabase(source.error);
    if (!source.data) throw new Error("Source missing");
    let bytes: Uint8Array;
    if (source.data.original_text !== null)
      bytes = new TextEncoder().encode(source.data.original_text);
    else {
      const file = await db.storage
        .from("case-sources")
        .download(source.data.storage_path);
      if (file.error || !file.data) throw new Error("Original unavailable");
      bytes = new Uint8Array(await file.data.arrayBuffer());
    }
    const extracted = await extractSource(bytes, source.data.format);
    const finish = await db.rpc("finish_case", {
      p_id: id,
      p_token: token,
      p_text: extracted.text,
      p_pages: extracted.pages,
      p_warnings: extracted.warnings,
      p_chunks: chunkPages(extracted.pages, source.data.format),
    });
    checkDatabase(finish.error);
  } catch (error) {
    const message =
      error instanceof InputError
        ? error.message
        : "Processing could not finish. Retry the retained original. If the original upload was interrupted, add the case again with its source.";
    const failed = await db
      .from("cases")
      .update({
        status: "failed",
        error_message: message,
        processing_token: null,
      })
      .eq("id", id)
      .eq("processing_token", token);
    checkDatabase(failed.error);
  }
  return caseDetail(id, sessionId);
}
