import { requestDocumentContext } from "@/features/query-files/server/repository";
import "server-only";
import { randomUUID } from "node:crypto";
import { checkDatabase, database } from "@/features/cases/server/db";
import { ApiError } from "@/features/cases/server/http";
import {
  budgetAssistantEvidence,
  retrieveAssistant,
} from "@/features/queries/server/assistant-retrieval";
import { evidenceIsCurrent } from "@/features/queries/server/evidence";
import { queryAIConfig, queryModel } from "@/features/queries/server/openai";
import {
  briefInput,
  clarificationPlan,
  generatedMarkdown,
  validateGenerated,
  validateMarkdown,
} from "../content";
import type { PlanBrief } from "../types";
import { planDetail } from "./repository";

function config() {
  const chat = queryAIConfig();
  if (!chat) return null;
  function limit(name: string, fallback: number) {
    if (process.env.NODE_ENV === "development") return null;
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 0)
      throw new ApiError(503, "Plan usage limits are misconfigured.");
    return value;
  }
  return {
    ...chat,
    sessionLimit: limit("AI_PLAN_SESSION_LIMIT", 50),
    dailyLimit: limit("AI_PLAN_DAILY_LIMIT", 100),
  };
}
export async function processPlan(
  id: string,
  stage: "prepare" | "generate",
  input: Record<string, unknown>,
  sessionId: string,
  dependencies: {
    model?: typeof queryModel;
    retrieve?: typeof retrieveAssistant;
  } = {},
) {
  let plan = await planDetail(id, sessionId);
  let confirmed: PlanBrief | null = null;
  if (stage === "generate") {
    try {
      confirmed = briefInput(input);
    } catch (error) {
      throw new ApiError(400, (error as Error).message);
    }
  }
  const token = randomUUID();
  const db = database();
  const claim = await db.rpc("claim_plan_operation", {
    p_session: sessionId,
    p_id: id,
    p_stage: stage,
    p_token: token,
    p_request: confirmed,
  });
  checkDatabase(claim.error);
  if (claim.data === "cached") return planDetail(id, sessionId);
  if (claim.data !== "claimed")
    throw new ApiError(
      claim.data === "missing" ? 404 : 409,
      "This draft is already processing or its confirmed request changed. Reopen it to check progress; create another plan to change the confirmed request.",
    );
  async function save(patch: Record<string, unknown>) {
    const result = await db
      .from("reuse_plans")
      .update(patch)
      .eq("id", id)
      .eq("session_id", sessionId)
      .eq("processing_token", token)
      .select("id");
    checkDatabase(result.error);
    if (!result.data?.length)
      throw new ApiError(
        409,
        "This draft was resumed elsewhere. Reopen it to check progress.",
      );
  }
  const fallback: PlanBrief = {
    ...plan.snapshot.originalRequest,
    request:
      plan.snapshot.messages.at(-1) ?? plan.snapshot.originalRequest.request,
    title: "New reuse plan",
    questions: "",
  };
  try {
    const ai = config();
    const model = dependencies.model ?? queryModel;
    async function call(kind: "reuse_brief" | "reuse_plan", payload: unknown) {
      if (!ai)
        throw new ApiError(
          503,
          "Configure OPENAI_API_KEY on the server to generate a plan. Your request is preserved.",
        );
      const reservation = await db.rpc("reserve_plan_ai", {
        p_session: sessionId,
        p_plan: id,
        p_token: token,
        p_session_limit: ai.sessionLimit,
        p_daily_limit: ai.dailyLimit,
      });
      checkDatabase(reservation.error);
      if (!reservation.data)
        throw new ApiError(
          429,
          "The plan generation limit was reached. Your draft is preserved; retry when capacity is available.",
        );
      return model(kind, payload, ai);
    }
    if (stage === "prepare") {
      const brief = briefInput(await call("reuse_brief", plan.snapshot), true);
      await save({
        brief,
        title: brief.title,
        status: "review",
        processing_token: null,
        failed_stage: null,
      });
    } else {
      // The confirmed brief, not earlier AI answers, defines the new project.
      plan = await planDetail(id, sessionId);
      const request = plan.confirmed_request;
      if (!request)
        throw new ApiError(
          409,
          "Review the project request before generating.",
        );
      const requestDocuments = await requestDocumentContext(
        plan.snapshot.requestDocuments?.documents.map((d) => d.id) ?? [],
        sessionId,
        request.request,
      );
      const retrieval = await (dependencies.retrieve ?? retrieveAssistant)(
        [
          [
            request.request,
            request.deadline,
            request.technology,
            request.capabilities,
            request.questions,
          ]
            .filter(Boolean)
            .join("\n"),
        ],
        plan.snapshot.context,
        [],
        sessionId,
        undefined,
        { includeOpenings: false },
      );
      const { evidence, limited } = budgetAssistantEvidence(retrieval.passages);
      const warnings = [
        ...retrieval.warnings,
        ...(limited
          ? [
              "Plan evidence is limited to 30 passages or 60,000 characters. Inspect additional sources if needed.",
            ]
          : []),
      ];
      await save({
        evidence,
        warnings,
        request_evidence: requestDocuments.evidence,
      });
      const generated = evidence.length
        ? validateGenerated(
            await call("reuse_plan", {
              request,
              requestDocuments,
              evidence,
              coverageWarnings: warnings,
            }),
            evidence,
          )
        : clarificationPlan();
      if (!(await evidenceIsCurrent(evidence, sessionId)))
        throw new ApiError(
          409,
          "Sources changed during generation. Retry to retrieve current evidence.",
        );
      await save({
        generated,
        generated_markdown: validateMarkdown(
          generatedMarkdown(generated, evidence),
          evidence,
        ),
        kind: generated.kind,
        status: "ready",
        processing_token: null,
        failed_stage: null,
      });
    }
  } catch (error) {
    await save({
      status: stage === "prepare" ? "review" : "failed",
      brief: stage === "prepare" ? fallback : plan.brief,
      failed_stage: stage,
      processing_token: null,
      error_message:
        error instanceof Error
          ? error.message
          : "Wren could not finish. Retry this draft.",
    });
  }
  return planDetail(id, sessionId);
}
