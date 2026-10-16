import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  CASE_READING_VERSION,
  mergeIndexes,
  READING_EXCERPTS_PER_STEP,
  type ReadingSource,
  type ReadingWork,
  readingProgress,
} from "../case-reading";
import {
  type CaseAnalysis,
  type CaseSuggestions,
  SUGGESTION_FIELDS,
} from "../case-suggestions";
import type { SourcePage } from "../types";
import { metadataField } from "../validation";
import { checkDatabase, database } from "./db";
import { ApiError, validId } from "./http";
import { caseAIConfig, suggestExcerpts } from "./openai";
import { accessibleCase, caseDetail } from "./repository";
import { createSourceExcerpts } from "./source-evidence";

export type CaseReaders = {
  read: typeof suggestExcerpts;
  merge: typeof combineReadings;
};
export async function combineReadings(
  drafts: CaseSuggestions[],
  config: { key: string; model: string },
  transport?: Parameters<typeof suggestExcerpts>[4],
  warnings?: string[],
): Promise<CaseSuggestions> {
  const refs: CaseSuggestions["context"]["evidence"] = [];
  const values = drafts.map((draft) =>
    Object.fromEntries(
      SUGGESTION_FIELDS.map((field) => [
        field,
        {
          value: draft[field].value,
          evidence: draft[field].evidence.map((ref) => {
            let index = refs.findIndex(
              (r) =>
                r.sourceId === ref.sourceId &&
                r.page === ref.page &&
                r.quote === ref.quote,
            );
            if (index < 0) {
              refs.push(ref);
              index = refs.length - 1;
            }
            return index + 1;
          }),
        },
      ]),
    ),
  );
  if (!refs.length) {
    const empty = { value: "", evidence: [] };
    return {
      title: { ...empty },
      context: { ...empty },
      outcome: { ...empty },
      lessons: { ...empty },
    };
  }
  // Synthetic locations are used only for strict selection validation. Restore original provenance below.
  const excerpts = refs.map((ref, i) => ({
    source_title: ref.sourceTitle,
    original_page: ref.page,
    id: i + 1,
    page: i + 1,
    quote: ref.quote,
  }));
  const result = await suggestExcerpts(
    excerpts,
    excerpts.map((e) => ({ number: e.page, text: e.quote })),
    true,
    config,
    transport,
    values,
    warnings,
  );
  return Object.fromEntries(
    SUGGESTION_FIELDS.map((field) => [
      field,
      {
        value: result[field].value,
        evidence: result[field].evidence.map((e) => refs[(e.page ?? 0) - 1]),
      },
    ]),
  ) as CaseSuggestions;
}
async function sourceSnapshot(caseId: string) {
  const result = await database()
    .from("source_documents")
    .select("id,title,format,version,char_count,status,warnings,page_count")
    .eq("case_id", caseId)
    .order("id");
  checkDatabase(result.error);
  if (!result.data?.length)
    throw new ApiError(
      400,
      "Upload documents before asking AI to read this case.",
    );
  if (result.data.some((source) => source.status !== "ready"))
    throw new ApiError(
      409,
      "Some documents are not ready. Finish or retry their text extraction before reading the complete case.",
    );
  return result.data;
}
function snapshotHash(
  caseId: string,
  sources: { id: string; version: number; char_count: number }[],
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        caseId,
        sources: sources.map((s) => [s.id, s.version, s.char_count]),
      }),
    )
    .digest("hex");
}
async function planReading(
  caseId: string,
  sources: Awaited<ReturnType<typeof sourceSnapshot>>,
): Promise<ReadingWork> {
  const snapshot: ReadingSource[] = [],
    segments: ReadingWork["segments"] = [],
    warnings: string[] = [];
  for (const source of sources) {
    const result = await database()
      .from("source_documents")
      .select("pages")
      .eq("id", source.id)
      .single();
    checkDatabase(result.error);
    const pages = result.data?.pages as SourcePage[];
    const excerpts = createSourceExcerpts(pages, source.format === "pdf");
    snapshot.push({
      id: source.id,
      title: source.title,
      format: source.format,
      version: source.version,
      chars: source.char_count,
      pages: source.page_count,
      hash: createHash("sha256").update(JSON.stringify(pages)).digest("hex"),
    });
    for (
      let start = 0;
      start < excerpts.length;
      start += READING_EXCERPTS_PER_STEP
    )
      segments.push({
        sourceId: source.id,
        start,
        end: Math.min(start + READING_EXCERPTS_PER_STEP, excerpts.length),
      });
    warnings.push(
      ...(source.warnings as string[]).map((w) => `${source.title}: ${w}`),
    );
  }
  return {
    caseId,
    sources: snapshot,
    segments,
    cursor: 0,
    nodes: [],
    calls: 0,
    warnings: warnings
      .slice(0, 50)
      .concat(
        warnings.length > 50
          ? [
              `${warnings.length - 50} more extraction warnings are retained with the original documents.`,
            ]
          : [],
      ),
  };
}
export async function advanceCaseReading(
  caseId: string,
  sessionId: string,
  requestedId?: string,
  readers: CaseReaders = { read: suggestExcerpts, merge: combineReadings },
) {
  const record = await accessibleCase(caseId, sessionId);
  if (record.is_seed)
    throw new ApiError(403, "Fictional samples are read-only.");
  const config = caseAIConfig(),
    db = database();
  const sources = await sourceSnapshot(caseId),
    hash = snapshotHash(caseId, sources);
  const existing = await db
    .from("case_ai_readings")
    .select("*")
    .eq("session_id", sessionId)
    .eq("source_hash", hash)
    .eq("model", config.model)
    .eq("prompt_version", CASE_READING_VERSION)
    .maybeSingle();
  checkDatabase(existing.error);
  let run = existing.data;
  if (requestedId && run?.id !== validId(requestedId))
    throw new ApiError(
      409,
      "Sources or reader settings changed. Start a new reading; your edits are preserved.",
    );
  if (run?.status === "ready")
    return readingProgress(run.id, "ready", run.work, null, run.result);
  if (
    !run ||
    run.status === "failed" ||
    (!run.work && Date.now() - Date.parse(run.started_at) >= 120_000)
  ) {
    const token = randomUUID();
    const claim = await db.rpc("reserve_case_ai_reading", {
      p_session: sessionId,
      p_hash: hash,
      p_model: config.model,
      p_version: CASE_READING_VERSION,
      p_token: token,
      p_session_limit: config.sessionLimit,
      p_daily_limit: config.dailyLimit,
    });
    checkDatabase(claim.error);
    if (claim.data?.state === "cached") {
      const cached = await db
        .from("case_ai_readings")
        .select("*")
        .eq("id", claim.data.id)
        .single();
      checkDatabase(cached.error);
      return readingProgress(
        cached.data.id,
        "ready",
        cached.data.work,
        null,
        cached.data.result,
      );
    }
    if (claim.data?.state !== "reserved")
      throw new ApiError(
        claim.data?.state === "busy" ? 409 : 429,
        claim.data?.state === "busy"
          ? "Another case is being read. Wait for it to finish, or retry an interrupted reading after two minutes."
          : "AI reading attempt limit reached. Your documents and completed reading stages are preserved.",
      );
    const work = run?.work ?? (await planReading(caseId, sources));
    const saved = await db
      .from("case_ai_readings")
      .update({
        case_id: caseId,
        work,
        error_message: null,
        processing_token: null,
      })
      .eq("id", claim.data.id)
      .eq("processing_token", token)
      .select("*")
      .single();
    checkDatabase(saved.error);
    run = saved.data;
  }
  if (!run?.work)
    throw new ApiError(
      409,
      "The reading is being initialized. Try again shortly.",
    );
  const token = randomUUID();
  const claim = await db.rpc("claim_case_reading_step", {
    p_id: run.id,
    p_session: sessionId,
    p_token: token,
  });
  checkDatabase(claim.error);
  if (!claim.data) return readingProgress(run.id, "processing", run.work);
  // A request may have waited while another step completed. Read its checkpoint
  // after claiming, so a stale request cannot repeat or overwrite that work.
  const checkpoint = await db
    .from("case_ai_readings")
    .select("work")
    .eq("id", run.id)
    .eq("processing_token", token)
    .single();
  checkDatabase(checkpoint.error);
  if (!checkpoint.data)
    throw new ApiError(
      409,
      "The reading changed. Retry to load saved progress.",
    );
  const work: ReadingWork = structuredClone(checkpoint.data.work);
  try {
    const merge = mergeIndexes(work);
    if (merge.length) {
      const selected = merge.map((i) => work.nodes[i]);
      const suggestions = await readers.merge(
        selected.map((n) => n.suggestions),
        { key: config.key, model: run.model },
        undefined,
        work.warnings,
      );
      work.nodes = work.nodes.filter((_, i) => !merge.includes(i));
      work.nodes.push({
        level: Math.max(...selected.map((n) => n.level)) + 1,
        suggestions,
      });
      work.calls++;
    } else if (work.cursor < work.segments.length) {
      const segment = work.segments[work.cursor],
        source = work.sources.find((s) => s.id === segment.sourceId);
      if (!source)
        throw new ApiError(
          409,
          "A source snapshot is missing. Start the reading again.",
        );
      const result = await db
        .from("source_documents")
        .select("pages,status")
        .eq("id", source.id)
        .single();
      checkDatabase(result.error);
      const pages = result.data?.pages as SourcePage[];
      if (
        result.data?.status !== "ready" ||
        createHash("sha256").update(JSON.stringify(pages)).digest("hex") !==
          source.hash
      )
        throw new ApiError(409, "The source changed. Start the reading again.");
      const excerpts = createSourceExcerpts(pages, source.format === "pdf")
        .slice(segment.start, segment.end)
        .map((e, i) => ({ ...e, id: i + 1 }));
      const suggestions = await readers.read(
        excerpts,
        pages,
        source.format === "pdf",
        { key: config.key, model: run.model },
        undefined,
        undefined,
        work.warnings,
      );
      for (const field of SUGGESTION_FIELDS)
        suggestions[field].evidence = suggestions[field].evidence.map((e) => ({
          ...e,
          sourceId: source.id,
          sourceTitle: source.title,
        }));
      work.nodes.push({ level: 0, suggestions });
      work.cursor++;
      work.calls++;
    }
    const complete =
      work.cursor === work.segments.length && work.nodes.length === 1;
    const result: CaseAnalysis | null = complete
      ? {
          id: run.id,
          caseId,
          sourceIds: work.sources.map((s) => s.id),
          model: run.model,
          promptVersion: CASE_READING_VERSION,
          suggestions: work.nodes[0].suggestions,
          warnings: work.warnings,
          pageCount: work.sources.reduce((n, s) => n + s.pages, 0),
          isPdf: work.sources.some((s) => s.format === "pdf"),
        }
      : null;
    const saved = await db.rpc("save_case_reading_step", {
      p_id: run.id,
      p_token: token,
      p_work: work,
      p_result: result,
    });
    checkDatabase(saved.error);
    if (!saved.data)
      throw new ApiError(
        409,
        "This reading step was superseded. Retry to load saved progress.",
      );
    return readingProgress(
      run.id,
      complete ? "ready" : "processing",
      work,
      null,
      result,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "AI reading failed. Retry the saved progress.";
    checkDatabase(
      (
        await db
          .from("case_ai_readings")
          .update({
            status: "failed",
            error_message: message,
            processing_token: null,
          })
          .eq("id", run.id)
          .eq("processing_token", token)
      ).error,
    );
    throw error;
  }
}
export async function reviewCaseReading(
  caseId: string,
  sessionId: string,
  input: Record<string, unknown>,
) {
  const record = await accessibleCase(caseId, sessionId);
  if (record.is_seed)
    throw new ApiError(403, "Fictional samples are read-only.");
  const fields = input.fields as Record<string, unknown> | undefined;
  const expected = input.expected as Record<string, unknown> | undefined;
  if (!fields || !expected)
    throw new ApiError(
      400,
      "Reviewed fields and the original case details are required.",
    );
  const values = Object.fromEntries(
    SUGGESTION_FIELDS.map((field) => [
      field,
      metadataField(
        typeof fields[field] === "string" ? fields[field] : null,
        field,
        field === "title" ? 200 : 5000,
        field === "title",
      ),
    ]),
  );
  const result = await database().rpc("review_case_reading", {
    p_case: caseId,
    p_session: sessionId,
    p_reading: validId(String(input.readingId ?? "")),
    p_input: values,
    p_expected: expected,
  });
  if (result.error && /changed|required/.test(result.error.message))
    throw new ApiError(409, result.error.message);
  checkDatabase(result.error);
  return caseDetail(caseId, sessionId);
}

export async function saveCaseFields(
  caseId: string,
  sessionId: string,
  input: Record<string, unknown>,
) {
  const record = await accessibleCase(caseId, sessionId);
  if (record.is_seed)
    throw new ApiError(403, "Fictional samples are read-only.");
  const fields = input.fields as Record<string, unknown> | undefined;
  if (!fields || !input.expected)
    throw new ApiError(
      400,
      "Case fields and their previous values are required.",
    );
  const values = Object.fromEntries(
    SUGGESTION_FIELDS.map((field) => [
      field,
      metadataField(
        typeof fields[field] === "string" ? fields[field] : null,
        field,
        field === "title" ? 200 : 5000,
        field === "title",
      ),
    ]),
  );
  const result = await database().rpc("save_case_fields", {
    p_case: caseId,
    p_session: sessionId,
    p_input: values,
    p_expected: input.expected,
  });
  if (result.error && /changed/.test(result.error.message))
    throw new ApiError(409, result.error.message);
  checkDatabase(result.error);
  return caseDetail(caseId, sessionId);
}
