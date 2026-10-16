import "server-only";
import { chunkPages } from "@/features/cases/extraction";
import { checkDatabase, database } from "@/features/cases/server/db";
import { embedTexts } from "@/features/cases/server/embeddings";
import { ApiError } from "@/features/cases/server/http";
import { groupPassages, meanQueryVector } from "../embedding-math";
import type { Passage, RetrievalResult } from "../types";

export async function retrieve(
  input: Record<string, unknown>,
  sessionId: string,
  embedder: typeof embedTexts = embedTexts,
): Promise<RetrievalResult> {
  const request = typeof input.request === "string" ? input.request.trim() : "";
  if (!request || request.length > 10000)
    throw new ApiError(400, "Enter a request of 1–10,000 characters.");
  const parts = [request];
  for (const key of ["deadline", "technology", "capabilities"]) {
    const value = input[key] ?? "";
    if (typeof value !== "string" || value.length > 1000)
      throw new ApiError(
        400,
        "Each constraint must contain at most 1,000 characters.",
      );
    if (value.trim()) parts.push(`${key}: ${value.trim()}`);
  }
  const query = parts.join("\n\n");
  const chunks = chunkPages([{ number: 1, text: query }], "text");
  const warnings: string[] = [];
  let vector: number[] | null = null;
  try {
    const vectors = await embedder(
      chunks.map((c) => c.text),
      sessionId,
    );
    vector = meanQueryVector(
      vectors,
      chunks.map((c) => c.text.length),
    );
  } catch (error) {
    warnings.push(
      `${error instanceof Error ? error.message : "Semantic search is unavailable."} Showing keyword matches only.`,
    );
  }
  const db = database();
  const [result, coverage] = await Promise.all([
    db.rpc("retrieve_passages", {
      p_session: sessionId,
      p_query: query,
      p_vector: vector ? JSON.stringify(vector) : null,
    }),
    db
      .from("cases")
      .select("source_documents(status,indexing_status)")
      .or(`is_seed.eq.true,session_id.eq.${sessionId}`),
  ]);
  checkDatabase(result.error);
  checkDatabase(coverage.error);
  const sources = (coverage.data ?? []).flatMap((c) => c.source_documents);
  const incomplete = sources.filter(
    (s) => s.status !== "ready" || s.indexing_status !== "ready",
  ).length;
  if (incomplete)
    warnings.push(
      `${incomplete} document(s) are not fully indexed. Results may omit relevant evidence; return to Case library to finish or retry processing.`,
    );
  return {
    cases: groupPassages((result.data ?? []) as Passage[]),
    mode: vector ? "hybrid" : "keyword",
    warnings,
  };
}
