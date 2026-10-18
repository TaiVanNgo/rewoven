import "server-only";
import { chunkPages } from "@/features/cases/extraction";
import { checkDatabase, database } from "@/features/cases/server/db";
import { embedTexts } from "@/features/cases/server/embeddings";
import { meanQueryVector } from "@/features/retrieval/embedding-math";
import type { Passage, RetrievalResult } from "@/features/retrieval/types";
import { evidenceBudget } from "../assistant";
import type { ChatContext, Evidence } from "../types";

export async function retrieveAssistant(
  queries: string[],
  context: ChatContext,
  narrowed: string[],
  sessionId: string,
  embedder: typeof embedTexts = (texts, session) =>
    embedTexts(texts, session, (url, init) =>
      fetch(url, {
        ...init,
        signal: AbortSignal.any([
          init?.signal ?? AbortSignal.timeout(15000),
          AbortSignal.timeout(15000),
        ]),
      }),
    ),
  options: { includeOpenings?: boolean } = {},
): Promise<{
  passages: Passage[];
  mode: RetrievalResult["mode"];
  warnings: string[];
}> {
  const db = database();
  const warnings: string[] = [];
  let caseIds = context.mode === "selected" ? context.caseIds : narrowed;
  if (context.mode === "samples") {
    let active = db
      .from("cases")
      .select("id")
      .eq("is_seed", true)
      .eq("sample_visible", true)
      .eq("status", "ready");
    if (narrowed.length) active = active.in("id", narrowed);
    const samples = await active;
    checkDatabase(samples.error);
    caseIds = (samples.data ?? []).map((s) => s.id);
    if (!caseIds.length)
      return {
        passages: [],
        mode: "keyword",
        warnings: [
          "The demo library has no available cases. Ask the demo owner to prepare its samples, or switch to your uploaded library.",
        ],
      };
  }
  let mode: RetrievalResult["mode"] = "hybrid";
  const queryChunks = queries.map((query) =>
    chunkPages([{ number: 1, text: query }], "text"),
  );
  const vectors = await Promise.all(
    queryChunks.map(async (chunks) => {
      const embedded = await embedder(
        chunks.map((c) => c.text),
        sessionId,
      );
      return meanQueryVector(
        embedded,
        chunks.map((c) => c.text.length),
      );
    }),
  ).catch(() => {
    mode = "keyword";
    warnings.push(
      "Semantic search is unavailable. Wren is using keyword matches; relevant passages may be missed.",
    );
    return [] as number[][];
  });
  // Separate selected-case calls prevent a large case from starving another before budgeting.
  const groups = caseIds.length ? caseIds.map((id) => [id]) : [null];
  const matches = await Promise.all(
    queries.flatMap((query, index) =>
      groups.map(async (ids) => {
        const result = await db.rpc("retrieve_assistant_passages", {
          p_session: sessionId,
          p_query: query,
          p_vector: vectors[index] ? JSON.stringify(vectors[index]) : null,
          p_cases: ids,
        });
        checkDatabase(result.error);
        return (result.data ?? []) as Passage[];
      }),
    ),
  );
  let sourcesQuery = db
    .from("source_documents")
    .select(
      "id,title,case_id,version,status,indexing_status,cases!inner(title,outcome,is_seed,session_id)",
    );
  sourcesQuery = caseIds.length
    ? sourcesQuery.in("case_id", caseIds)
    : sourcesQuery.eq("cases.session_id", sessionId).eq("cases.is_seed", false);
  const sources = await sourcesQuery;
  checkDatabase(sources.error);
  if (
    sources.data?.some(
      (s) => s.status !== "ready" || s.indexing_status !== "ready",
    )
  )
    warnings.push(
      "Some documents are not fully indexed. Wren can use readable keyword matches, but coverage may be incomplete.",
    );
  const passages: Passage[] = matches.flat();
  // Original opening passages support broad summaries without relying on editable metadata.
  // All documents remain eligible for ranked retrieval; this fallback is only for attached cases.
  if (context.mode === "selected" && options.includeOpenings !== false) {
    const openings = await Promise.all(
      (sources.data ?? [])
        .filter((s) => s.status === "ready")
        .map(async (source) => {
          const chunks = await db
            .from("source_chunks")
            .select("id,page_number,char_start,char_end,text")
            .eq("source_id", source.id)
            .order("ordinal")
            .limit(1);
          checkDatabase(chunks.error);
          const record = source.cases as unknown as {
            title: string;
            outcome: string;
          };
          return (chunks.data ?? []).map((chunk) => ({
            chunk_id: chunk.id,
            source_id: source.id,
            case_id: source.case_id,
            title: record.title,
            outcome: record.outcome,
            source_title: source.title,
            version: source.version,
            page_number: chunk.page_number,
            char_start: chunk.char_start,
            char_end: chunk.char_end,
            text: chunk.text,
            score: 0,
          }));
        }),
    );
    passages.push(...openings.flat());
  }
  return { passages, mode, warnings };
}

export function assistantRetrievalResult(
  passages: Evidence[],
  mode: RetrievalResult["mode"],
  warnings: string[],
): RetrievalResult {
  const cases: RetrievalResult["cases"] = [];
  for (const passage of passages) {
    let record = cases.find((c) => c.id === passage.case_id);
    if (!record) {
      record = {
        id: passage.case_id,
        title: passage.title,
        outcome: passage.outcome,
        passages: [],
      };
      cases.push(record);
    }
    record.passages.push(passage);
  }
  return { cases, mode, warnings: [...new Set(warnings)] };
}
export function budgetAssistantEvidence(passages: Passage[]) {
  const evidence = evidenceBudget(
    passages.map((item) => ({ ...item, id: "" })),
  );
  return {
    evidence,
    limited: new Set(passages.map((p) => p.chunk_id)).size > evidence.length,
  };
}
