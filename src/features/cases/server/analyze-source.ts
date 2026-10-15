import "server-only";
import { randomUUID } from "node:crypto";
import type { CaseAnalysis } from "../case-suggestions";
import { extractSource } from "../extraction";
import { checkDatabase, database } from "./db";
import { ApiError } from "./http";
import { CASE_PROMPT_VERSION, caseAIConfig, suggestCase } from "./openai";
import { sourceInput } from "./source-input";

export async function analyzeSource(
  form: FormData,
  sessionId: string,
  reader: typeof suggestCase = suggestCase,
): Promise<CaseAnalysis> {
  const config = caseAIConfig();
  const source = await sourceInput(form);
  const extracted = await extractSource(source.bytes, source.format);
  const db = database();
  const token = randomUUID();
  const claim = await db.rpc("reserve_case_ai_reading", {
    p_session: sessionId,
    p_hash: source.hash,
    p_model: config.model,
    p_version: CASE_PROMPT_VERSION,
    p_token: token,
    p_session_limit: config.sessionLimit,
    p_daily_limit: config.dailyLimit,
  });
  checkDatabase(claim.error);
  if (claim.data?.state === "cached")
    return { ...claim.data.result, id: claim.data.id } as CaseAnalysis;
  if (claim.data?.state === "expired")
    throw new ApiError(
      401,
      "Your demo session expired. Reload the library to start again.",
    );
  if (claim.data?.state === "busy")
    throw new ApiError(
      409,
      "A source is already being read in this session. Wait for it to finish; interrupted readings can retry after two minutes.",
    );
  if (claim.data?.state === "session_limit")
    throw new ApiError(
      429,
      "This demo session has reached its AI reading limit. You can still add cases manually.",
    );
  if (claim.data?.state === "daily_limit")
    throw new ApiError(
      429,
      "Rewoven has reached its daily AI reading limit. Try after midnight UTC, or add the case manually.",
    );
  if (claim.data?.state !== "reserved")
    throw new ApiError(
      503,
      "AI reading could not start. Try again or enter details manually.",
    );
  try {
    const result: Omit<CaseAnalysis, "id"> = {
      model: config.model,
      promptVersion: CASE_PROMPT_VERSION,
      suggestions: await reader(
        extracted.pages,
        source.format === "pdf",
        config,
      ),
      warnings: extracted.warnings,
      pageCount: extracted.pages.length,
      isPdf: source.format === "pdf",
    };
    const saved = await db
      .from("case_ai_readings")
      .update({ status: "ready", result, processing_token: null })
      .eq("id", claim.data.id)
      .eq("processing_token", token)
      .eq("status", "processing")
      .select("id")
      .maybeSingle();
    checkDatabase(saved.error);
    if (!saved.data)
      throw new ApiError(
        409,
        "This reading was superseded. Read the source again to load the latest suggestions.",
      );
    return { ...result, id: saved.data.id };
  } catch (error) {
    const failed = await db
      .from("case_ai_readings")
      .update({ status: "failed", processing_token: null })
      .eq("id", claim.data.id)
      .eq("processing_token", token)
      .eq("status", "processing");
    checkDatabase(failed.error);
    throw error;
  }
}
