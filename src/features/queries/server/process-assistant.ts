import { requestDocumentContext } from "@/features/query-files/server/repository";
import { FILE_ONLY_MESSAGE } from "@/features/query-files/types";
import "server-only";
import { randomUUID } from "node:crypto";
import { checkDatabase, database } from "@/features/cases/server/db";
import type { embedTexts } from "@/features/cases/server/embeddings";
import { ApiError, validId } from "@/features/cases/server/http";
import { accessibleCase } from "@/features/cases/server/repository";
import { assistantPlanInput } from "../assistant";
import { conversationContext, namedCases } from "../context";
import type { QueryWork } from "../types";
import { queryText, validateAnswer } from "../validation";
import { WREN_PROMPT_VERSION } from "./assistant-prompt";
import {
  assistantRetrievalResult,
  budgetAssistantEvidence,
  retrieveAssistant,
} from "./assistant-retrieval";
import { evidenceIsCurrent } from "./evidence";
import { queryAIConfig, queryModel } from "./openai";
import { queryDetail } from "./repository";

export async function processAssistantTurn(
  conversationId: string,
  input: Record<string, unknown>,
  sessionId: string,
  dependencies: {
    model?: typeof queryModel;
    embedder?: typeof embedTexts;
  } = {},
) {
  const id = validId(String(input.requestKey ?? ""));
  const previous = await queryDetail(conversationId, sessionId);
  const hasPendingFiles = previous.files?.some(
    (f) => f.enabled && !f.first_turn_id,
  );
  const message = queryText(
    hasPendingFiles && !String(input.message ?? "").trim()
      ? FILE_ONLY_MESSAGE
      : input.message,
  );
  if (
    !Number.isSafeInteger(input.contextRevision) ||
    Number(input.contextRevision) < 0
  )
    throw new ApiError(
      400,
      "A context revision is required. Reopen this chat.",
    );
  await queryDetail(conversationId, sessionId);
  const token = randomUUID();
  const db = database();
  const claim = await db.rpc("claim_assistant_turn", {
    p_session: sessionId,
    p_conversation: conversationId,
    p_id: id,
    p_message: message,
    p_revision: input.contextRevision,
    p_token: token,
  });
  checkDatabase(claim.error);
  if (claim.data?.state === "cached")
    return queryDetail(conversationId, sessionId);
  if (claim.data?.state !== "claimed")
    throw new ApiError(
      claim.data?.state === "missing" ? 404 : 409,
      claim.data?.state === "files_pending"
        ? "Finish reading the attached files, or explicitly exclude failed or incomplete files before sending."
        : claim.data?.state === "context_changed"
          ? "The case selection changed. Reopen this chat before sending."
          : "Wren is already answering, or this turn cannot be retried. Reopen the chat to check progress.",
    );
  const conversation = await queryDetail(conversationId, sessionId);
  const turn = conversation.turns.find((t) => t.id === id);
  if (!turn?.context_snapshot)
    throw new ApiError(503, "Could not restore this turn's case selection.");
  async function save(patch: Record<string, unknown>) {
    const result = await db
      .from("query_turns")
      .update(patch)
      .eq("id", id)
      .eq("processing_token", token)
      .select("id");
    checkDatabase(result.error);
    if (!result.data?.length)
      throw new ApiError(
        409,
        "This turn was resumed elsewhere. Reopen the chat.",
      );
  }
  try {
    const context = turn.context_snapshot;
    await Promise.all(
      context.caseIds.map((id) => accessibleCase(id, sessionId)),
    );
    const config = queryAIConfig();
    const model = dependencies.model ?? queryModel;
    const history = conversationContext(conversation, turn);
    const requestDocuments = await requestDocumentContext(
      turn.request_file_ids ?? [],
      sessionId,
      message,
    );
    let catalogQuery = db
      .from("cases")
      .select("id,title,is_seed")
      .order("created_at")
      .limit(201);
    catalogQuery =
      context.mode === "selected"
        ? catalogQuery
            .in("id", context.caseIds)
            .or(`is_seed.eq.true,session_id.eq.${sessionId}`)
        : context.mode === "samples"
          ? catalogQuery
              .eq("is_seed", true)
              .eq("sample_visible", true)
              .eq("status", "ready")
          : catalogQuery.eq("session_id", sessionId).eq("is_seed", false);
    const catalogResult = await catalogQuery;
    checkDatabase(catalogResult.error);
    const catalog = (catalogResult.data ?? []).slice(0, 200);
    const warnings = [...history.warnings];
    if ((catalogResult.data?.length ?? 0) > 200)
      warnings.push(
        "Case-name interpretation covers the first 200 uploads. Use Add cases to select another case directly.",
      );
    if (config) {
      const reserved = await db.rpc("reserve_query_ai", {
        p_session: sessionId,
        p_turn: id,
        p_token: token,
        p_session_limit: config.sessionLimit,
        p_daily_limit: config.dailyLimit,
      });
      checkDatabase(reserved.error);
      if (!reserved.data)
        throw new ApiError(
          429,
          "Wren's chat limit was reached. Your message is saved; retry when capacity is available.",
        );
    }
    const promptInput = {
      ...history,
      requestDocuments,
      context,
      catalog,
      promptVersion: WREN_PROMPT_VERSION,
    };
    const plan = config
      ? assistantPlanInput(
          await model("assistant_plan", promptInput, config),
          catalog.map((c) => c.id),
        )
      : {
          intent: "search" as const,
          queries: [message],
          caseIds: [],
          reply: "",
        };
    let work: QueryWork = {
      searchQuery: plan.queries.join("\n"),
      focusTitle: null,
      focus: { scope: "library", caseId: null },
      clarification: "",
      candidates: [],
      retrieval: { cases: [], mode: "keyword", warnings },
      evidence: [],
      requestEvidence: requestDocuments.evidence,
    };
    if (plan.intent !== "search") {
      if (plan.intent === "clarify") work.clarification = plan.reply;
      await save({
        work,
        answer: {
          sections: [
            {
              kind: "conversation",
              heading: "",
              text: plan.reply,
              evidence: [],
            },
          ],
        },
        status: "ready",
        phase: null,
        processing_token: null,
        error_message: null,
      });
      return queryDetail(conversationId, sessionId);
    }
    await save({ phase: "reviewing" });
    // A planner may repeat IDs from an earlier answer. Only explicit case names
    // in this message may narrow collection-wide discovery. Attached cases keep
    // their existing exclusive scope inside retrieveAssistant.
    const explicitlyNamed = new Set(
      namedCases(message, catalog).map((c) => c.id),
    );
    const narrowed =
      context.mode === "selected"
        ? plan.caseIds
        : plan.caseIds.filter((id) => explicitlyNamed.has(id));
    const retrieved = await retrieveAssistant(
      plan.queries,
      context,
      narrowed,
      sessionId,
      dependencies.embedder,
    );
    const passages = [...retrieved.passages];
    warnings.push(...retrieved.warnings);
    let { evidence, limited } = budgetAssistantEvidence(passages);
    work = {
      ...work,
      evidence,
      retrieval: assistantRetrievalResult(evidence, retrieved.mode, warnings),
    };
    await save({ work });
    if (config) {
      const review = (await model(
        "assistant_review",
        { ...promptInput, evidence },
        config,
      )) as { query?: unknown };
      if (
        !review ||
        typeof review.query !== "string" ||
        review.query.length > 10000
      )
        throw new ApiError(
          502,
          "Wren returned an invalid evidence check. Retry this turn.",
        );
      if (review.query.trim()) {
        const more = await retrieveAssistant(
          [review.query],
          context,
          narrowed,
          sessionId,
          dependencies.embedder,
        );
        passages.unshift(...more.passages);
        warnings.push(
          ...more.warnings,
          "Wren used an additional search to check missing details. This answer is limited to the retrieved passages.",
        );
        ({ evidence, limited } = budgetAssistantEvidence(passages));
      }
    }
    if (limited)
      warnings.push(
        "The evidence limit was reached (30 passages or 60,000 characters). Ask a narrower follow-up to explore other details.",
      );
    const covered = new Set(evidence.map((e) => e.case_id));
    if (
      context.mode === "selected" &&
      context.caseIds.some((id) => !covered.has(id))
    )
      warnings.push(
        "Some attached cases supplied no readable evidence for this answer.",
      );
    work = {
      ...work,
      evidence,
      retrieval: assistantRetrievalResult(evidence, retrieved.mode, warnings),
    };
    await save({ work, phase: "answering" });
    if (!config)
      throw new ApiError(
        503,
        "Configure OPENAI_API_KEY on the server to chat with Wren. Keyword excerpts remain available below.",
      );
    if (!evidence.length && !requestDocuments.evidence.length) {
      await save({
        answer: {
          sections: [
            {
              kind: "unknown",
              heading: "",
              text: "I couldn’t find supporting original passages in the allowed cases. Add a case with readable sources, finish processing its documents in Case library, or ask a more specific question. What project or decision should we focus on?",
              evidence: [],
            },
          ],
        },
        status: "ready",
        phase: null,
        processing_token: null,
        error_message: null,
      });
      return queryDetail(conversationId, sessionId);
    }
    const answer = validateAnswer(
      await model(
        "assistant_answer",
        { ...promptInput, evidence, coverageWarnings: work.retrieval.warnings },
        config,
      ),
      evidence,
      true,
      requestDocuments.evidence,
    );
    if (!(await evidenceIsCurrent(evidence, sessionId)))
      throw new ApiError(
        409,
        "Sources changed while Wren was answering. Retry for current evidence.",
      );
    await save({
      answer,
      status: "ready",
      phase: null,
      processing_token: null,
      error_message: null,
    });
  } catch (error) {
    await save({
      status: "failed",
      phase: null,
      processing_token: null,
      error_message:
        error instanceof Error
          ? error.message
          : "Wren could not finish. Retry this turn.",
    });
  }
  return queryDetail(conversationId, sessionId);
}
