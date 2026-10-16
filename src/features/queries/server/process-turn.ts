import "server-only";
import { randomUUID } from "node:crypto";
import { checkDatabase, database } from "@/features/cases/server/db";
import { embedTexts } from "@/features/cases/server/embeddings";
import { ApiError, validId } from "@/features/cases/server/http";
import { accessibleCase } from "@/features/cases/server/repository";
import { retrieve } from "@/features/retrieval/server/retrieve";
import {
  conversationContext,
  namedCases,
  type QueryPlan,
  validatePlan,
} from "../context";
import type { QueryFocus } from "../types";
import { focusInput, queryText, validateAnswer } from "../validation";
import { evidenceIsCurrent, gatherEvidence } from "./evidence";
import { queryAIConfig, queryModel } from "./openai";
import { queryDetail } from "./repository";

export async function processQueryTurn(
  conversationId: string,
  input: Record<string, unknown>,
  sessionId: string,
  dependencies: {
    model?: typeof queryModel;
    embedder?: typeof embedTexts;
  } = {},
) {
  const id = validId(String(input.requestKey ?? ""));
  const message = queryText(input.message);
  const focus = focusInput(input);
  const token = randomUUID();
  const db = database();
  await queryDetail(conversationId, sessionId);
  if (focus.caseId) await accessibleCase(focus.caseId, sessionId);
  const claim = await db.rpc("claim_query_turn", {
    p_session: sessionId,
    p_conversation: conversationId,
    p_id: id,
    p_message: message,
    p_scope: focus.scope,
    p_case: focus.caseId,
    p_token: token,
  });
  checkDatabase(claim.error);
  if (claim.data?.state === "cached")
    return queryDetail(conversationId, sessionId);
  if (claim.data?.state !== "claimed")
    throw new ApiError(
      claim.data?.state === "missing" ? 404 : 409,
      claim.data?.state === "busy"
        ? "A turn is already being processed. Reopen this query to check progress; interrupted turns can be retried after five minutes."
        : "This turn cannot be changed or retried after a newer question. Send a new question instead.",
    );
  const conversation = await queryDetail(conversationId, sessionId);
  const turn = conversation.turns.find((item) => item.id === id);
  if (!turn)
    throw new ApiError(503, "Could not restore this turn. Reopen the query.");
  let work = turn.work;
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
        "This turn was resumed by another request. Reopen the query.",
      );
  }
  try {
    const context = conversationContext(conversation, turn);
    const catalogResult = await db
      .from("cases")
      .select("id,title")
      .or(`is_seed.eq.true,session_id.eq.${sessionId}`)
      .order("created_at")
      .limit(201);
    checkDatabase(catalogResult.error);
    const catalog = (catalogResult.data ?? []).slice(0, 200);
    if (focus.caseId && !catalog.some((record) => record.id === focus.caseId)) {
      const record = await accessibleCase(focus.caseId, sessionId);
      catalog.push({ id: record.id, title: record.title });
    }
    const config = queryAIConfig();
    if (!config) {
      context.warnings.push(
        "Wren's answers need OPENAI_API_KEY on the server. Showing original passages only.",
      );
    } else {
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
          "The chat generation limit was reached. Your question and any retrieved evidence are saved. Retry when capacity is available.",
        );
    }
    if (work && !(await evidenceIsCurrent(work.evidence, sessionId)))
      work = null;
    if (!work) {
      let plan: QueryPlan = {
        query: message,
        caseId: focus.caseId,
        related: focus.scope === "related",
        clarification: "",
        candidates: [],
      };
      const named = namedCases(message, catalog);
      if (config) {
        plan = validatePlan(
          await (dependencies.model ?? queryModel)(
            "plan",
            { ...context, focus, catalog },
            config,
          ),
          catalog,
          focus,
        );
      } else if (focus.scope === "library" && named.length === 1) {
        plan.caseId = named[0].id;
        plan.related = /\b(similar|related|other)\b/i.test(message);
      } else if (focus.scope === "library" && named.length > 1) {
        plan.clarification = "Which case should I focus on?";
        plan.candidates = named.slice(0, 6).map((record) => record.id);
      }
      // Exact duplicate names cannot safely be resolved by the model.
      if (
        focus.scope === "library" &&
        named.length > 1 &&
        new Set(named.map((item) => item.title.toLowerCase())).size === 1
      ) {
        plan.clarification =
          "Several cases share that title. Choose the case you mean.";
        plan.candidates = named.slice(0, 6).map((item) => item.id);
      }
      const resolvedFocus: QueryFocus = {
        scope: plan.caseId ? (plan.related ? "related" : "case") : "library",
        caseId: plan.caseId,
      };
      if (plan.related && !plan.caseId)
        plan.clarification = "Choose a case first so I can find related work.";
      work = {
        searchQuery: plan.query,
        focusTitle:
          catalog.find((record) => record.id === plan.caseId)?.title ?? null,
        focus: resolvedFocus,
        clarification: plan.clarification,
        candidates: catalog.filter((record) =>
          plan.candidates.includes(record.id),
        ),
        retrieval: {
          cases: [],
          mode: "keyword",
          warnings: [...context.warnings],
        },
        evidence: [],
      };
      if (catalogResult.data && catalogResult.data.length > 200)
        work.retrieval.warnings.push(
          "Case-name resolution covers the first 200 cases. Select a case from the library to focus on a different one.",
        );
      if (!plan.clarification) {
        let query = plan.query;
        if (plan.related && plan.caseId) {
          const reference = await accessibleCase(plan.caseId, sessionId);
          query =
            `${query}\nReference case: ${reference.title}\n${reference.context}`.slice(
              0,
              10000,
            );
          if (
            `${plan.query}\nReference case: ${reference.title}\n${reference.context}`
              .length > 10000
          )
            work.retrieval.warnings.push(
              "The reference case context was shortened for this related-case search. Ask a more specific question if important details are missing.",
            );
        }
        const result = await retrieve(
          { ...conversation.request, request: query },
          sessionId,
          dependencies.embedder ?? embedTexts,
          {
            conversational: true,
            caseId:
              resolvedFocus.scope === "case"
                ? (plan.caseId ?? undefined)
                : undefined,
            excludeCaseId: plan.related
              ? (plan.caseId ?? undefined)
              : undefined,
          },
        );
        work.retrieval = {
          ...result,
          warnings: [...work.retrieval.warnings, ...result.warnings],
        };
        work.evidence = await gatherEvidence(
          work.retrieval,
          resolvedFocus,
          sessionId,
        );
      }
      work.retrieval.warnings.push(
        "Answers use selected excerpts, not a complete reading of every document. Inspect the originals for additional context.",
      );
      await save({ work });
    }
    if (work.clarification || !work.evidence.length) {
      await save({
        answer: {
          sections: [
            {
              kind: "unknown",
              heading: work.clarification
                ? "A little clarification"
                : "No supporting evidence found",
              text:
                work.clarification ||
                "I couldn't find relevant original passages. Try a more specific capability, select a case, or finish indexing its sources in the case library.",
              evidence: [],
            },
          ],
        },
        status: "ready",
        processing_token: null,
      });
    } else if (!config) {
      await save({
        status: "failed",
        error_message:
          "AI answers are unavailable. The matched original passages remain available; retry after configuring the server.",
        processing_token: null,
      });
    } else {
      const answer = validateAnswer(
        await (dependencies.model ?? queryModel)(
          "answer",
          {
            ...context,
            focus: work.focus,
            cases: work.retrieval.cases.map(({ id, title, outcome }) => ({
              id,
              title,
              outcome,
            })),
            evidence: work.evidence,
          },
          config,
        ),
        work.evidence,
      );
      if (!(await evidenceIsCurrent(work.evidence, sessionId)))
        throw new ApiError(
          409,
          "Sources changed while Wren was answering. Retry to retrieve current evidence.",
        );
      await save({
        answer,
        status: "ready",
        error_message: null,
        processing_token: null,
      });
    }
  } catch (error) {
    await save({
      status: "failed",
      error_message:
        error instanceof Error
          ? error.message
          : "Wren could not finish. Retry this turn.",
      processing_token: null,
    });
  }
  return queryDetail(conversationId, sessionId);
}
