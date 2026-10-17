import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";
import type {
  Evidence,
  QueryConversation,
} from "../src/features/queries/types";

mock.module("server-only", () => ({}));
const { createQuery, updateChatContext, queryDetail } =
  await import("../src/features/queries/server/repository");
const { processAssistantTurn } =
  await import("../src/features/queries/server/process-assistant");
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("Wren routes conversation, scopes multi-case evidence, persists context, and protects retries", async () => {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const sessionIds: string[] = [],
    sampleIds: string[] = [];
  const old = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_CHAT_SESSION_LIMIT: process.env.AI_CHAT_SESSION_LIMIT,
    AI_CHAT_DAILY_LIMIT: process.env.AI_CHAT_DAILY_LIMIT,
  };
  process.env.OPENAI_API_KEY = "mock-assistant-key";
  process.env.AI_CHAT_SESSION_LIMIT = "10000";
  process.env.AI_CHAT_DAILY_LIMIT = "1000000";
  async function session() {
    const token = newSessionToken();
    const result = await db
      .from("demo_sessions")
      .insert({ token_hash: hashSessionToken(token) })
      .select("id")
      .single();
    assert.ifError(result.error);
    sessionIds.push(result.data.id);
    return { id: result.data.id, cookie: `rewoven-session=${token}` };
  }
  async function addCase(owner: string, title: string, sources = 1) {
    const id = randomUUID();
    assert.ifError(
      (
        await db.from("cases").insert({
          id,
          session_id: owner,
          is_seed: false,
          request_key: id,
          title,
          context: "Delivery",
          status: "ready",
        })
      ).error,
    );
    for (let i = 0; i < sources; i++) {
      const sourceId = randomUUID();
      const text =
        i === sources - 1
          ? `${title}: zebracaveat caused a delay. The team recorded a pilot outcome.`
          : `${title}: background source ${i}.`;
      assert.ifError(
        (
          await db.from("source_documents").insert({
            id: sourceId,
            case_id: id,
            title: `source-${i}.md`,
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
            source_id: sourceId,
            ordinal: 0,
            char_start: 0,
            char_end: text.length,
            text,
          })
        ).error,
      );
    }
    return id;
  }
  try {
    const a = await session(),
      b = await session();
    const first = await addCase(a.id, "First project", 8),
      second = await addCase(a.id, "Second project"),
      third = await addCase(a.id, "Third project"),
      fourth = await addCase(a.id, "Fourth project"),
      foreign = await addCase(b.id, "Private project"),
      sample = await addCase(a.id, "Fictional sample");
    assert.ifError(
      (
        await db
          .from("cases")
          .update({ is_seed: true, session_id: null, sample_visible: true })
          .eq("id", sample)
      ).error,
    );
    sampleIds.push(sample);
    let q = await createQuery(
      { requestKey: randomUUID(), request: "Hi", assistant: true },
      a.id,
    );
    let calls: string[] = [],
      embeddings = 0;
    const deps = {
      embedder: async () => {
        embeddings++;
        throw new Error("keyword fallback");
      },
      model: async (kind: string, input: unknown) => {
        calls.push(kind);
        const payload = input as {
          question: string;
          catalog: { id: string }[];
          evidence?: Evidence[];
        };
        assert.ok(payload.catalog.every((c) => c.id !== foreign));
        if (kind === "assistant_plan")
          return {
            intent: payload.question === "Hi" ? "conversation" : "search",
            queries: payload.question === "Hi" ? [] : ["zebracaveat"],
            caseIds: [],
            reply: "Hi! What would you like to explore?",
          };
        if (kind === "assistant_review") return { query: "pilot outcome" };
        assert.ok(payload.evidence?.length);
        return {
          sections: [
            {
              kind: "fact",
              heading: "",
              text: "The records describe a delay.",
              evidence: [payload.evidence[0].id],
            },
            {
              kind: "recommendation",
              heading: "",
              text: "Use the recorded delay as a checkpoint in your next review.",
              evidence: [payload.evidence[0].id],
            },
          ],
        };
      },
    };
    q = await processAssistantTurn(
      q.id,
      { requestKey: q.id, message: "Hi", contextRevision: 0 },
      a.id,
      deps,
    );
    assert.equal(q.turns[0].status, "ready", q.turns[0].error_message ?? "");
    assert.deepEqual(calls, ["assistant_plan"]);
    assert.equal(embeddings, 0);
    assert.equal(q.turns[0].answer?.sections[0].kind, "conversation");
    for (const intent of ["clarify", "create_case"]) {
      const beforeCalls: number = embeddings;
      q = await processAssistantTurn(
        q.id,
        { requestKey: randomUUID(), message: intent, contextRevision: 0 },
        a.id,
        {
          ...deps,
          model: async (kind) => {
            assert.equal(kind, "assistant_plan");
            return {
              intent,
              queries: [],
              caseIds: [],
              reply:
                intent === "clarify"
                  ? "Which project should we explore?"
                  : "Create the case in Case library, then attach it here.",
            };
          },
        },
      );
      assert.equal(q.turns.at(-1)?.status, "ready");
      assert.equal(embeddings, beforeCalls);
    }
    q = await updateChatContext(
      q.id,
      {
        chatContext: { mode: "selected", caseIds: [first, second] },
        contextRevision: 0,
      },
      a.id,
    );
    assert.equal(q.context_revision, 1);
    await assert.rejects(
      updateChatContext(
        q.id,
        {
          chatContext: { mode: "selected", caseIds: [foreign] },
          contextRevision: 1,
        },
        a.id,
      ),
      /not found/,
    );
    await assert.rejects(
      updateChatContext(
        q.id,
        { chatContext: { mode: "library", caseIds: [] }, contextRevision: 0 },
        a.id,
      ),
      /selection changed/,
    );
    await assert.rejects(
      processAssistantTurn(
        q.id,
        { requestKey: randomUUID(), message: "stale", contextRevision: 0 },
        a.id,
        deps,
      ),
      /selection changed/,
    );
    const input = {
      requestKey: randomUUID(),
      message: "Compare delays",
      contextRevision: 1,
    };
    calls = [];
    q = await processAssistantTurn(q.id, input, a.id, deps);
    const result = q.turns.at(-1);
    assert.ok(result);
    assert.equal(result.status, "ready", result.error_message ?? "");
    assert.deepEqual(calls, [
      "assistant_plan",
      "assistant_review",
      "assistant_answer",
    ]);
    assert.deepEqual(
      new Set(result.work?.evidence.map((e) => e.case_id)),
      new Set([first, second]),
    );
    assert.ok(
      result.work?.evidence.some((e) => e.source_title === "source-7.md"),
      "eighth source remains searchable",
    );
    assert.ok(
      result.work?.retrieval.warnings.some((w) => w.includes("keyword")),
    );
    const count = calls.length;
    await processAssistantTurn(q.id, input, a.id, deps);
    assert.equal(calls.length, count);
    const before = result.context_snapshot;
    q = await updateChatContext(
      q.id,
      { chatContext: { mode: "library", caseIds: [] }, contextRevision: 1 },
      a.id,
    );
    assert.deepEqual(q.turns.at(-1)?.context_snapshot, before);
    q = await processAssistantTurn(
      q.id,
      {
        requestKey: randomUUID(),
        message: "Review all uploaded cases",
        contextRevision: 2,
      },
      a.id,
      deps,
    );
    assert.deepEqual(
      new Set(q.turns.at(-1)?.work?.evidence.map((e) => e.case_id)),
      new Set([first, second, third, fourth]),
    );
    assert.ok(
      q.turns
        .at(-1)
        ?.work?.evidence.every(
          (e) => e.case_id !== sample && e.case_id !== foreign,
        ),
    );
    q = await processAssistantTurn(
      q.id,
      { requestKey: randomUUID(), message: "No match", contextRevision: 2 },
      a.id,
      {
        ...deps,
        model: async (kind) => {
          if (kind === "assistant_plan")
            return {
              intent: "search",
              queries: ["qxzyabsentword"],
              caseIds: [],
              reply: "",
            };
          assert.equal(
            kind,
            "assistant_review",
            "No answer model call without evidence",
          );
          return { query: "" };
        },
      },
    );
    assert.equal(q.turns.at(-1)?.status, "ready");
    assert.equal(q.turns.at(-1)?.answer?.sections[0].kind, "unknown");
    // An explicit sample selection is permitted and survives restore.
    q = await updateChatContext(
      q.id,
      {
        chatContext: { mode: "selected", caseIds: [sample] },
        contextRevision: 2,
      },
      a.id,
    );
    q = await processAssistantTurn(
      q.id,
      {
        requestKey: randomUUID(),
        message: "Review the selected sample",
        contextRevision: 3,
      },
      a.id,
      deps,
    );
    assert.ok(
      q.turns.at(-1)?.work?.evidence.every((e) => e.case_id === sample),
    );
    assert.equal(q.selected_cases?.[0].is_seed, true);
    const raceInput = {
      requestKey: randomUUID(),
      message: "Check current sources",
      contextRevision: 3,
    };
    q = await processAssistantTurn(q.id, raceInput, a.id, {
      ...deps,
      model: async (kind, input) => {
        const answer = await deps.model(kind, input);
        if (kind === "assistant_answer")
          assert.ifError(
            (
              await db
                .from("source_documents")
                .update({ version: 2 })
                .eq("case_id", sample)
            ).error,
          );
        return answer;
      },
    });
    assert.equal(q.turns.at(-1)?.status, "failed");
    assert.match(q.turns.at(-1)?.error_message ?? "", /Sources changed/);
    q = await processAssistantTurn(q.id, raceInput, a.id, deps);
    assert.equal(q.turns.at(-1)?.status, "ready");
    assert.ok(q.turns.at(-1)?.work?.evidence.every((e) => e.version === 2));
    const failedInput = {
      requestKey: randomUUID(),
      message: "Retry source review",
      contextRevision: 3,
    };
    q = await processAssistantTurn(q.id, failedInput, a.id, {
      ...deps,
      model: async (kind, input) =>
        kind === "assistant_answer"
          ? {
              sections: [
                {
                  kind: "fact",
                  heading: "",
                  text: "forged",
                  evidence: ["fake"],
                },
              ],
            }
          : deps.model(kind, input),
    });
    assert.equal(q.turns.at(-1)?.status, "failed");
    q = await updateChatContext(
      q.id,
      {
        chatContext: { mode: "selected", caseIds: [second] },
        contextRevision: 3,
      },
      a.id,
    );
    q = await processAssistantTurn(q.id, failedInput, a.id, deps);
    assert.equal(q.turns.at(-1)?.status, "ready");
    assert.ok(
      q.turns.at(-1)?.work?.evidence.every((e) => e.case_id === sample),
      "retry uses old snapshot",
    );
    // A live lease serializes selection changes and simultaneous turns.
    const claimId = randomUUID();
    const claim = await db.rpc("claim_assistant_turn", {
      p_session: a.id,
      p_conversation: q.id,
      p_id: claimId,
      p_message: "Working",
      p_revision: 4,
      p_token: randomUUID(),
    });
    assert.equal(claim.data.state, "claimed");
    await assert.rejects(
      updateChatContext(
        q.id,
        { chatContext: { mode: "library", caseIds: [] }, contextRevision: 4 },
        a.id,
      ),
      /selection changed/,
    );
    await assert.rejects(
      processAssistantTurn(
        q.id,
        { requestKey: randomUUID(), message: "parallel", contextRevision: 4 },
        a.id,
        deps,
      ),
      /already answering/,
    );
    await db
      .from("query_turns")
      .update({ status: "failed", processing_token: null })
      .eq("id", claimId);
    const response = await fetch(`${base}/api/queries/${q.id}/context`, {
      method: "PATCH",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        chatContext: { mode: "library", caseIds: [] },
        contextRevision: 4,
      }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    const restored = (await response.json()) as { query: QueryConversation };
    assert.equal(restored.query.chat_context?.mode, "library");
    assert.equal(JSON.stringify(restored).includes("processing_token"), false);
    assert.equal(
      (
        await fetch(`${base}/api/queries/${q.id}/context`, {
          method: "PATCH",
          headers: { Cookie: b.cookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            chatContext: { mode: "library", caseIds: [] },
            contextRevision: 5,
          }),
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(`${base}/api/queries/${q.id}/context`, {
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
    await assert.rejects(queryDetail(q.id, b.id), /not found/);
    // Unreadable cases cannot be attached.
    const empty = await addCase(a.id, "Empty", 0);
    await assert.rejects(
      updateChatContext(
        q.id,
        {
          chatContext: { mode: "selected", caseIds: [empty] },
          contextRevision: 5,
        },
        a.id,
      ),
      /no readable/,
    );
    delete process.env.OPENAI_API_KEY;
    q = await processAssistantTurn(
      q.id,
      { requestKey: randomUUID(), message: "zebracaveat", contextRevision: 5 },
      a.id,
      {
        embedder: deps.embedder,
        model: async () => {
          throw new Error("No provider calls without a key");
        },
      },
    );
    assert.equal(q.turns.at(-1)?.status, "failed");
    assert.ok(q.turns.at(-1)?.work?.evidence.length);
    await db
      .from("demo_sessions")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", a.id);
    await assert.rejects(queryDetail(q.id, a.id), /expired/);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await db.from("demo_sessions").delete().in("id", sessionIds);
    if (sampleIds.length) await db.from("cases").delete().in("id", sampleIds);
  }
});
