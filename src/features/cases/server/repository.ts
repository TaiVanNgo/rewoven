import "server-only";
import type { CaseAIReview } from "../case-suggestions";
import type {
  CaseDetail,
  CaseRecord,
  CaseSummary,
  SourceDocument,
} from "../types";
import { checkDatabase, database } from "./db";
import { ApiError, validId } from "./http";

export async function accessibleCase(
  id: string,
  sessionId: string,
): Promise<CaseRecord & { session_id: string | null }> {
  const { data, error } = await database()
    .from("cases")
    .select("*")
    .eq("id", validId(id))
    .or(`is_seed.eq.true,session_id.eq.${sessionId}`)
    .maybeSingle();
  checkDatabase(error);
  if (!data) throw new ApiError(404, "Case not found in this demo session.");
  return data;
}
export async function listCases(
  sessionId: string,
  query: string,
): Promise<CaseSummary[]> {
  const db = database();
  const { data, error } = await db.rpc("search_cases", {
    p_session_id: sessionId,
    p_query: query.slice(0, 200),
  });
  checkDatabase(error);
  const cases: CaseRecord[] = data ?? [];
  // Keep recent additions first and shared examples in their original seed order.
  cases.sort(
    (a, b) =>
      Number(a.is_seed) - Number(b.is_seed) ||
      (a.is_seed
        ? a.created_at.localeCompare(b.created_at)
        : b.created_at.localeCompare(a.created_at)),
  );
  if (!cases.length) return [];
  const sources = await db
    .from("source_documents")
    .select("id, case_id, title, format")
    .in(
      "case_id",
      cases.map((c) => c.id),
    );
  checkDatabase(sources.error);
  return cases.map((c) => ({
    ...publicCase(c),
    sources: (sources.data ?? []).filter((s) => s.case_id === c.id),
  }));
}
export async function caseDetail(
  id: string,
  sessionId: string,
): Promise<CaseDetail> {
  const record = await accessibleCase(id, sessionId);
  const { data, error } = await database()
    .from("source_documents")
    .select("id,case_id,title,format,version,extracted_text,pages,warnings")
    .eq("case_id", record.id)
    .order("created_at");
  checkDatabase(error);
  const review = await database()
    .from("case_ai_reviews")
    .select("source_id,created_at,case_ai_readings(id,result)")
    .eq("case_id", record.id)
    .maybeSingle();
  checkDatabase(review.error);
  const reading = review.data?.case_ai_readings as unknown as {
    id: string;
    result: Omit<CaseAIReview, "id" | "sourceId" | "createdAt">;
  } | null;
  const aiReview: CaseAIReview | null =
    reading && review.data
      ? {
          ...reading.result,
          id: reading.id,
          sourceId: review.data.source_id,
          createdAt: review.data.created_at,
        }
      : null;
  return {
    ...publicCase(record),
    sources: (data ?? []) as SourceDocument[],
    aiReview,
  };
}

function publicCase(record: CaseRecord): CaseRecord {
  const {
    id,
    is_seed,
    title,
    context,
    outcome,
    lessons,
    status,
    error_message,
    processing_started_at,
    created_at,
  } = record;
  return {
    id,
    is_seed,
    title,
    context,
    outcome,
    lessons,
    status,
    error_message,
    processing_started_at,
    created_at,
  };
}
