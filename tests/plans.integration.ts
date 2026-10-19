import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";
import type { ReusePlan } from "../src/features/plans/types";
import type { Evidence } from "../src/features/queries/types";
import { registrationPlan } from "./fixtures/reuse-plan";

mock.module("server-only", () => ({}));
const { createQuery, updateChatContext } =
  await import("../src/features/queries/server/repository");
const { createPlan, planDetail, listPlans, savePlan } =
  await import("../src/features/plans/server/repository");
const { processPlan } = await import("../src/features/plans/server/process");
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
test("reuse plans preserve evidence, explicit saves, export, retries and session boundaries", async () => {
  assert.ok(
    ["127.0.0.1", "localhost"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const sessions: string[] = [];
  const oldKey = process.env.OPENAI_API_KEY;
  const oldLimit = process.env.AI_PLAN_SESSION_LIMIT;
  process.env.OPENAI_API_KEY = "test-mocked-key";
  async function session() {
    const token = newSessionToken();
    const result = await db
      .from("demo_sessions")
      .insert({ token_hash: hashSessionToken(token) })
      .select("id")
      .single();
    assert.ifError(result.error);
    sessions.push(result.data.id);
    return { id: result.data.id as string, cookie: `rewoven-session=${token}` };
  }
  try {
    const a = await session(),
      b = await session();
    const caseId = randomUUID(),
      sourceId = randomUUID(),
      chunkId = randomUUID();
    const text =
      "The registration pilot used transaction-enforced seat leases. Outcome was not recorded.";
    assert.ifError(
      (
        await db.from("cases").insert({
          id: caseId,
          session_id: a.id,
          request_key: caseId,
          title: "Registration pilot",
          status: "ready",
        })
      ).error,
    );
    assert.ifError(
      (
        await db.from("source_documents").insert({
          id: sourceId,
          case_id: caseId,
          title: "journal.md",
          format: "md",
          original_text: text,
          extracted_text: text,
          status: "ready",
          indexing_status: "ready",
        })
      ).error,
    );
    assert.ifError(
      (
        await db.from("source_chunks").insert({
          id: chunkId,
          source_id: sourceId,
          ordinal: 0,
          char_start: 0,
          char_end: text.length,
          text,
        })
      ).error,
    );
    const q = await createQuery(
      {
        requestKey: randomUUID(),
        request: "Plan concurrent registration",
        assistant: true,
        chatContext: { mode: "selected", caseIds: [caseId] },
      },
      a.id,
    );
    const input = { requestKey: randomUUID(), contextRevision: 0 };
    let plan = await createPlan(q.id, input, a.id);
    const evidence: Evidence[] = [
      {
        id: "e1",
        case_id: caseId,
        source_id: sourceId,
        chunk_id: chunkId,
        title: "Registration pilot",
        source_title: "journal.md",
        version: 1,
        page_number: null,
        char_start: 0,
        char_end: text.length,
        text,
        outcome: "",
        score: 1,
      },
    ];
    let calls = 0;
    const brief = {
      title: "Registration reuse plan",
      request: "Build concurrent registration with audit history",
      deadline: "",
      technology: "",
      capabilities: "",
      questions: "What is the required capacity?",
    };
    const dependencies = {
      model: async (kind: string) => {
        calls++;
        if (kind === "reuse_brief") return brief;
        return registrationPlan();
      },
      retrieve: async (
        _queries: string[],
        context: unknown,
        _narrowed: string[],
        _session: string,
        _embedder?: unknown,
        options?: unknown,
      ) => {
        assert.deepEqual(context, { mode: "selected", caseIds: [caseId] });
        assert.deepEqual(options, { includeOpenings: false });
        return {
          passages: evidence,
          mode: "keyword" as const,
          warnings: ["Keyword fallback"],
        };
      },
    };
    plan = await processPlan(plan.id, "prepare", {}, a.id, dependencies);
    assert.equal(plan.status, "review");
    assert.equal((await createPlan(q.id, input, a.id)).id, plan.id);
    await processPlan(plan.id, "prepare", {}, a.id, dependencies);
    assert.equal(calls, 1, "duplicate preparation is cached");
    await assert.rejects(planDetail(plan.id, b.id), /not found/);
    await updateChatContext(
      q.id,
      { contextRevision: 0, chatContext: { mode: "library", caseIds: [] } },
      a.id,
    );
    plan = await processPlan(plan.id, "generate", brief, a.id, dependencies);
    assert.equal(plan.status, "ready", plan.error_message ?? "");
    assert.equal(
      plan.snapshot.context.mode,
      "selected",
      "generation keeps captured selection",
    );
    assert.match(plan.generated_markdown ?? "", /\[S1\]/);
    assert.equal(plan.generated?.formatVersion, 2);
    assert.match(plan.generated_markdown ?? "", /## Proposed outcome/);
    assert.match(plan.generated_markdown ?? "", /\n1\. Agree/);
    assert.match(plan.generated_markdown ?? "", /\*\*Done when:\*\*/);
    assert.equal(
      (await listPlans(a.id)).length,
      0,
      "generation is not an explicit save",
    );
    await processPlan(plan.id, "generate", brief, a.id, dependencies);
    assert.equal(calls, 2, "duplicate generation is cached");
    await assert.rejects(
      processPlan(
        plan.id,
        "generate",
        { ...brief, request: "Changed" },
        a.id,
        dependencies,
      ),
      /confirmed request changed/,
    );
    const edited = `${plan.generated_markdown}\n\nA user-authored next step.`;
    plan = await savePlan(
      plan.id,
      { title: "Reviewed registration plan", markdown: edited, revision: 0 },
      a.id,
    );
    assert.equal(plan.revision, 1);
    assert.equal(
      (await listPlans(a.id))[0].title,
      "Reviewed registration plan",
    );
    assert.notEqual(plan.generated_markdown, plan.saved_markdown);
    await assert.rejects(
      savePlan(
        plan.id,
        { title: "Stale overwrite", markdown: "Lost edits", revision: 0 },
        a.id,
      ),
      /another tab/,
    );
    await assert.rejects(
      savePlan(
        plan.id,
        { title: "Forged", markdown: "[S8]", revision: 1 },
        a.id,
      ),
      /Unknown/,
    );
    const response = await fetch(`${base}/api/plans/${plan.id}/export`, {
      headers: { Cookie: a.cookie },
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get("content-type") ?? "", /text\/markdown/);
    const exported = await response.text();
    assert.match(exported, /Reviewed registration plan/);
    assert.match(exported, /user-authored next step/);
    assert.match(exported, /transaction-enforced/);
    assert.equal(
      (
        await fetch(`${base}/api/plans/${plan.id}`, {
          headers: { Cookie: b.cookie },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(`${base}/api/plans/${plan.id}/export`, {
          headers: { Cookie: b.cookie },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(`${base}/api/plans/${plan.id}`, {
          method: "PATCH",
          headers: {
            Cookie: a.cookie,
            Origin: "https://foreign.invalid",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    const restored = await fetch(`${base}/api/plans/${plan.id}`, {
      headers: { Cookie: a.cookie },
    });
    const body = (await restored.json()) as { plan: ReusePlan };
    assert.equal(body.plan.saved_markdown, edited);
    assert.equal(JSON.stringify(body).includes("processing_token"), false);
    assert.ifError(
      (
        await db
          .from("source_documents")
          .update({ version: 2 })
          .eq("id", sourceId)
      ).error,
    );
    assert.equal((await planDetail(plan.id, a.id)).evidence[0].stale, true);
    const other = await createPlan(
      q.id,
      { requestKey: randomUUID(), contextRevision: 1 },
      a.id,
    );
    assert.notEqual(other.id, plan.id);
    delete process.env.OPENAI_API_KEY;
    const manual = await processPlan(other.id, "prepare", {}, a.id, {
      model: async () => {
        throw new Error("Must not call provider without key");
      },
    });
    assert.equal(manual.status, "review");
    assert.ok(manual.brief);
    assert.match(manual.error_message ?? "", /API key settings/);
    const empty = await processPlan(other.id, "generate", brief, a.id, {
      retrieve: async () => ({ passages: [], mode: "keyword", warnings: [] }),
    });
    assert.equal(empty.status, "ready");
    assert.equal(empty.kind, "clarification");
    assert.equal(empty.evidence.length, 0);
    assert.equal(
      (
        await fetch(`${base}/api/plans/${empty.id}/export`, {
          headers: { Cookie: a.cookie },
        })
      ).status,
      409,
    );
    process.env.OPENAI_API_KEY = "test-mocked-key";
    process.env.AI_PLAN_SESSION_LIMIT = "10000";
    const retryDraft = await createPlan(
      q.id,
      { requestKey: randomUUID(), contextRevision: 1 },
      a.id,
    );
    await processPlan(retryDraft.id, "prepare", {}, a.id, dependencies);
    const currentEvidence = evidence.map((e) => ({ ...e, version: 2 }));
    const currentRetrieve = async () => ({
      passages: currentEvidence,
      mode: "keyword" as const,
      warnings: [],
    });
    const invalid = await processPlan(retryDraft.id, "generate", brief, a.id, {
      retrieve: currentRetrieve,
      model: async () => ({ kind: "reuse", sections: [] }),
    });
    assert.equal(invalid.status, "failed");
    assert.match(invalid.error_message ?? "", /invalid plan/);
    process.env.AI_PLAN_SESSION_LIMIT = "0";
    const limited = await processPlan(retryDraft.id, "generate", brief, a.id, {
      retrieve: currentRetrieve,
      model: async () => {
        throw new Error("Budget must block provider calls");
      },
    });
    assert.match(limited.error_message ?? "", /limit was reached/);
    process.env.AI_PLAN_SESSION_LIMIT = "10000";
    let announce: () => void = () => {};
    let release: () => void = () => {};
    const entered = new Promise<void>((resolve) => {
      announce = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = processPlan(retryDraft.id, "generate", brief, a.id, {
      retrieve: currentRetrieve,
      model: async (kind) => {
        announce();
        await gate;
        return dependencies.model(kind);
      },
    });
    await entered;
    try {
      await assert.rejects(
        processPlan(retryDraft.id, "generate", brief, a.id, dependencies),
        /already processing/,
      );
    } finally {
      release();
    }
    assert.equal(
      (await running).status,
      "ready",
      "failed generation can be retried without duplicating the plan",
    );
    assert.equal(
      (await planDetail(plan.id, a.id)).saved_markdown,
      edited,
      "a new generation preserves the earlier saved plan",
    );
    await db
      .from("demo_sessions")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", a.id);
    await assert.rejects(planDetail(plan.id, a.id), /expired/);
  } finally {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
    if (oldLimit === undefined) delete process.env.AI_PLAN_SESSION_LIMIT;
    else process.env.AI_PLAN_SESSION_LIMIT = oldLimit;
    await db.from("demo_sessions").delete().in("id", sessions);
  }
});
