import "server-only";
import { checkDatabase, database } from "@/features/cases/server/db";
import { accessibleCase } from "@/features/cases/server/repository";
import type { Passage, RetrievalResult } from "@/features/retrieval/types";
import type { Evidence, QueryFocus } from "../types";

export async function gatherEvidence(
  result: RetrievalResult,
  focus: QueryFocus,
  sessionId: string,
): Promise<Evidence[]> {
  const db = database();
  if (
    focus.scope === "case" &&
    focus.caseId &&
    !result.cases.some((record) => record.id === focus.caseId)
  ) {
    const record = await accessibleCase(focus.caseId, sessionId);
    result.cases = [
      {
        id: record.id,
        title: record.title,
        outcome: record.outcome,
        passages: [],
      },
    ];
  }
  const evidence: Evidence[] = [];
  for (const record of result.cases) {
    await accessibleCase(record.id, sessionId);
    const sources = await db
      .from("source_documents")
      .select("id,title,version,status,indexing_status")
      .eq("case_id", record.id)
      .eq("status", "ready")
      .order("created_at");
    checkDatabase(sources.error);
    const docs = sources.data ?? [];
    if (docs.length > 6)
      result.warnings.push(
        `Evidence for ${record.title} covers at most six documents. Ask a more specific question or inspect the remaining originals.`,
      );
    // Cover each selected document before adding relevance-ranked passages.
    const context = await Promise.all(
      docs.slice(0, 6).map(async (source) => {
        const [first, cautions] = await Promise.all([
          db
            .from("source_chunks")
            .select("id,page_number,char_start,char_end,text")
            .eq("source_id", source.id)
            .order("ordinal")
            .limit(1),
          db
            .from("source_chunks")
            .select("id,page_number,char_start,char_end,text")
            .eq("source_id", source.id)
            .textSearch(
              "search_vector",
              "outcome OR lesson OR caveat OR failed OR limitation OR retrospective",
              { type: "websearch", config: "english" },
            )
            .order("ordinal")
            .limit(1),
        ]);
        checkDatabase(first.error);
        checkDatabase(cautions.error);
        return [...(cautions.data ?? []), ...(first.data ?? [])].map(
          (chunk): Passage => ({
            chunk_id: chunk.id,
            source_id: source.id,
            case_id: record.id,
            title: record.title,
            source_title: source.title,
            version: source.version,
            page_number: chunk.page_number,
            char_start: chunk.char_start,
            char_end: chunk.char_end,
            text: chunk.text,
            outcome: record.outcome,
            score: 0,
          }),
        );
      }),
    );
    const seen = new Set<string>();
    const passages = [...record.passages, ...context.flat()]
      .filter((passage) => {
        if (seen.has(passage.chunk_id)) return false;
        seen.add(passage.chunk_id);
        return true;
      })
      .slice(0, 9);
    record.passages = passages;
    evidence.push(
      ...passages.map((passage, index) => ({
        ...passage,
        id: `e${evidence.length + index + 1}`,
      })),
    );
  }
  result.cases = result.cases.filter((record) => record.passages.length);
  return evidence;
}

export async function evidenceIsCurrent(
  evidence: Evidence[],
  sessionId: string,
) {
  if (!evidence.length) return true;
  for (const id of new Set(evidence.map((item) => item.case_id)))
    await accessibleCase(id, sessionId);
  const chunks = await database()
    .from("source_chunks")
    .select("id,source_id,text,source_documents!inner(version,status)")
    .in(
      "id",
      evidence.map((item) => item.chunk_id),
    );
  checkDatabase(chunks.error);
  return evidence.every((item) =>
    chunks.data?.some((chunk) => {
      const source = chunk.source_documents as unknown as {
        version: number;
        status: string;
      };
      return (
        chunk.id === item.chunk_id &&
        chunk.source_id === item.source_id &&
        chunk.text === item.text &&
        source.version === item.version &&
        source.status === "ready"
      );
    }),
  );
}
