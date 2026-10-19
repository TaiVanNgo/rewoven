import "server-only";
import { openAIKey, providerError } from "@/features/ai-key/server";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from "@/features/retrieval/embedding-math";
import { checkDatabase, database } from "./db";
import { ApiError } from "./http";

function budget(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ApiError(503, "Embedding budgets are misconfigured.");
  return value;
}
export async function embedTexts(
  texts: string[],
  sessionId: string | null,
  transport: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<number[][]> {
  const key = openAIKey();
  if (!key || key.includes("your-api-key"))
    throw new ApiError(
      503,
      "Semantic indexing needs an OpenAI key. Add yours in API key settings. Original text and keyword search remain available.",
    );
  if (texts.length > 16 || texts.some((t) => !t.trim() || t.length > 2000))
    throw new ApiError(
      400,
      "Embedding passages must contain 1–2,000 characters; at most 16 per batch.",
    );
  // UTF-8 byte count is a conservative token upper bound; settle to provider usage on success.
  const reserved = texts.reduce(
    (n, t) => n + new TextEncoder().encode(t).length,
    0,
  );
  const db = database();
  const claim = await db.rpc("reserve_embedding_budget", {
    p_session: sessionId,
    p_tokens: reserved,
    p_session_limit: budget("EMBEDDING_SESSION_TOKEN_LIMIT", 2_000_000),
    p_daily_limit: budget("EMBEDDING_DAILY_TOKEN_LIMIT", 10_000_000),
  });
  if (claim.error) {
    if (/budget|expired/i.test(claim.error.message))
      throw new ApiError(429, claim.error.message);
    checkDatabase(claim.error);
  }
  let response: Response;
  try {
    response = await transport("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
        encoding_format: "float",
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });
  } catch {
    throw new ApiError(
      504,
      "Embedding request timed out. Completed passages are preserved; retry indexing.",
    );
  }
  if (!response.ok) throw providerError(response.status, "create embeddings");
  const body = await response.json();
  const data = Array.isArray(body.data)
    ? body.data.toSorted(
        (a: { index: number }, b: { index: number }) => a.index - b.index,
      )
    : [];
  if (
    data.length !== texts.length ||
    data.some(
      (item: { index: number; embedding: number[] }, i: number) =>
        item.index !== i ||
        !Array.isArray(item.embedding) ||
        item.embedding.length !== EMBEDDING_DIMENSIONS ||
        item.embedding.some((v) => !Number.isFinite(v)) ||
        Math.hypot(...item.embedding) === 0,
    )
  )
    throw new ApiError(
      502,
      "OpenAI returned invalid embeddings. Retry indexing.",
    );
  const used = body.usage?.total_tokens;
  if (Number.isSafeInteger(used) && used >= 0 && used <= reserved)
    checkDatabase(
      (
        await db
          .from("embedding_usage")
          .update({ tokens: used })
          .eq("id", claim.data)
      ).error,
    );
  return data.map((item: { embedding: number[] }) => item.embedding);
}
