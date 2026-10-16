import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";
import type { QueryConversation } from "../src/features/queries/types";

mock.module("server-only", () => ({}));
const { createQuery, queryDetail, listQueries } =
  await import("../src/features/queries/server/repository");
const { processQueryTurn } =
  await import("../src/features/queries/server/process-turn");
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);
const vector = () => Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));

test("persisted queries isolate sessions, focus evidence, recover failures, and deduplicate generation", async () => {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const sessions: string[] = [];
  const oldKey = process.env.OPENAI_API_KEY,
    oldSessionLimit = process.env.AI_CHAT_SESSION_LIMIT,
    oldDailyLimit = process.env.AI_CHAT_DAILY_LIMIT;
  process.env.OPENAI_API_KEY = "test-mocked-key";
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
    sessions.push(result.data.id);
    return { id: result.data.id, cookie: `rewoven-session=${token}` };
  }
  async function addCase(sessionId: string, title: string, text: string) {
    const id = randomUUID(),
      sourceId = randomUUID();
    const record = await db.from("cases").insert({
      id,
      session_id: sessionId,
      is_seed: false,
      request_key: id,
      title,
      context: "Manager approval",
      status: "ready",
    });
    assert.ifError(record.error);
    const source = await db.from("source_documents").insert({
      id: sourceId,
      case_id: id,
      title: "retro.md",
      format: "md",
      original_text: text,
      extracted_text: text,
      status: "ready",
      indexing_status: "ready",
    });
    assert.ifError(source.error);
    const chunk = await db.from("source_chunks").insert({
      source_id: sourceId,
      ordinal: 0,
      page_number: null,
      char_start: 0,
      char_end: text.length,
      text,
      embedding: JSON.stringify(vector()),
      embedding_model: "text-embedding-3-small",
    });
    assert.ifError(chunk.error);
    return id;
  }
  try {
    const a = await session(),
      b = await session();
    const first = await addCase(
      a.id,
      "Integration approval portal",
      "The team shipped manager approval. Caveat: synchronous webhooks delayed approval.",
    );
    const related = await addCase(
      a.id,
      "Integration related workflow",
      "Manager approval had a documented audit log. Outcome: a pilot shipped.",
    );
    const foreign = await addCase(
      b.id,
      "Foreign secret portal",
      "Private unrelated case evidence.",
    );
    const query = await createQuery(
      {
        requestKey: randomUUID(),
        request: "Build two approval stages",
        caseId: first,
      },
      a.id,
    );
    let modelCalls = 0;
    const deps = {
      embedder: async (texts: string[]) => texts.map(vector),
      model: async (kind: "plan" | "answer", input: unknown) => {
        modelCalls++;
        if (kind === "plan")
          return {
            query: "manager approval audit",
            caseId: null,
            related: false,
            clarification: "",
            candidates: [],
          };
        const evidence = (input as { evidence: { id: string }[] }).evidence;
        return {
          sections: [
            {
              kind: "fact",
              heading: "Recorded approach",
              text: "The source documents manager approval.",
              evidence: [evidence[0].id],
            },
            {
              kind: "inference",
              heading: "What changes",
              text: "Two stages require an adapted flow.",
              evidence: [evidence[0].id],
            },
          ],
        };
      },
    };
    const input = {
      requestKey: query.id,
      message: query.request.request,
      scope: "case",
      caseId: first,
    };
    const answered = await processQueryTurn(query.id, input, a.id, deps);
    assert.equal(
      answered.turns[0].status,
      "ready",
      answered.turns[0].error_message ?? "",
    );
    assert.ok(
      answered.turns[0].work?.evidence.every((item) => item.case_id === first),
    );
    assert.equal(modelCalls, 2);
    await processQueryTurn(query.id, input, a.id, deps);
    assert.equal(modelCalls, 2);
    await assert.rejects(
      processQueryTurn(query.id, { ...input, message: "tampered" }, a.id, deps),
      /cannot be changed/,
    );
    await assert.rejects(queryDetail(query.id, b.id), /not found/);
    await assert.rejects(
      processQueryTurn(
        query.id,
        { ...input, requestKey: randomUUID(), caseId: foreign },
        a.id,
        deps,
      ),
      /not found/,
    );

    const api = await fetch(`${base}/api/queries/${query.id}`, {
      headers: { Cookie: a.cookie },
    });
    assert.equal(api.status, 200, await api.clone().text());
    const restored = (await api.json()) as { query: QueryConversation };
    assert.deepEqual(restored.query.turns[0].answer, answered.turns[0].answer);
    assert.equal(JSON.stringify(restored).includes("processing_token"), false);
    assert.equal(
      (
        await fetch(`${base}/api/queries/${query.id}`, {
          headers: { Cookie: b.cookie },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(`${base}/api/queries/${query.id}/turns`, {
          method: "POST",
          headers: {
            Cookie: a.cookie,
            "Content-Type": "application/json",
            Origin: "https://foreign.invalid",
          },
          body: JSON.stringify(input),
        })
      ).status,
      403,
    );

    const relatedAnswer = await processQueryTurn(
      query.id,
      {
        requestKey: randomUUID(),
        message: "Find related cases",
        scope: "related",
        caseId: first,
      },
      a.id,
      deps,
    );
    assert.equal(relatedAnswer.turns[1].status, "ready");
    assert.ok(
      relatedAnswer.turns[1].work?.retrieval.cases.some(
        (record) => record.id === related,
      ),
    );
    assert.ok(
      relatedAnswer.turns[1].work?.evidence.every(
        (item) => item.case_id !== first && item.case_id !== foreign,
      ),
    );

    const failureInput = {
      requestKey: randomUUID(),
      message: "What caveats matter?",
      scope: "case",
      caseId: first,
    };
    const failed = await processQueryTurn(query.id, failureInput, a.id, {
      ...deps,
      model: async (kind, input) =>
        kind === "answer"
          ? {
              sections: [
                {
                  kind: "fact",
                  heading: "Bad",
                  text: "Unsupported",
                  evidence: ["invented"],
                },
              ],
            }
          : deps.model(kind, input),
    });
    assert.equal(failed.turns[2].status, "failed");
    assert.ok(failed.turns[2].work?.evidence.length);
    const recovered = await processQueryTurn(
      query.id,
      failureInput,
      a.id,
      deps,
    );
    assert.equal(recovered.turns.length, 3);
    assert.equal(recovered.turns[2].status, "ready");
    assert.equal((await listQueries(a.id))[0].id, query.id);

    // Concurrent claims cannot duplicate work; an expired lease can be resumed.
    const turnId = randomUUID(),
      token = randomUUID();
    const claims = await Promise.all(
      [token, randomUUID()].map((worker) =>
        db.rpc("claim_query_turn", {
          p_session: a.id,
          p_conversation: query.id,
          p_id: turnId,
          p_message: "Concurrent question",
          p_scope: "case",
          p_case: first,
          p_token: worker,
        }),
      ),
    );
    assert.deepEqual(claims.map((result) => result.data.state).sort(), [
      "busy",
      "claimed",
    ]);
    await db
      .from("query_turns")
      .update({ started_at: new Date(Date.now() - 360000).toISOString() })
      .eq("id", turnId);
    const resumed = await processQueryTurn(
      query.id,
      {
        requestKey: turnId,
        message: "Concurrent question",
        scope: "case",
        caseId: first,
      },
      a.id,
      deps,
    );
    assert.equal(resumed.turns.at(-1)?.status, "ready");

    // Budget reservations across separate conversations share one atomic session limit.
    const tokens: string[] = [],
      turnIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const q = await createQuery(
        { requestKey: randomUUID(), request: "Budget question" },
        b.id,
      );
      const t = randomUUID(),
        worker = randomUUID();
      tokens.push(worker);
      turnIds.push(t);
      const claim = await db.rpc("claim_query_turn", {
        p_session: b.id,
        p_conversation: q.id,
        p_id: t,
        p_message: "Budget question",
        p_scope: "library",
        p_case: null,
        p_token: worker,
      });
      assert.equal(claim.data.state, "claimed");
    }
    const budgets = await Promise.all(
      tokens.map((worker, i) =>
        db.rpc("reserve_query_ai", {
          p_session: b.id,
          p_turn: turnIds[i],
          p_token: worker,
          p_session_limit: 1,
          p_daily_limit: 1000000,
        }),
      ),
    );
    assert.equal(budgets.filter((result) => result.data === true).length, 1);

    const duplicateTitle = "Integration duplicate case";
    await addCase(a.id, duplicateTitle, "First project's manager approval.");
    await addCase(a.id, duplicateTitle, "Second project's manager approval.");
    const ambiguous = await processQueryTurn(
      query.id,
      {
        requestKey: randomUUID(),
        message: `Tell me about ${duplicateTitle}`,
        scope: "library",
        caseId: null,
      },
      a.id,
      deps,
    );
    assert.equal(ambiguous.turns.at(-1)?.status, "ready");
    assert.equal(ambiguous.turns.at(-1)?.work?.candidates.length, 2);
    assert.equal(ambiguous.turns.at(-1)?.work?.evidence.length, 0);

    const noMatch = await processQueryTurn(
      query.id,
      {
        requestKey: randomUUID(),
        message: "xylophonic nebulizer quasar",
        scope: "library",
        caseId: null,
      },
      a.id,
      {
        embedder: async (texts) =>
          texts.map(() =>
            Array.from({ length: 1536 }, (_, i) => (i === 1499 ? 1 : 0)),
          ),
        model: async (kind) => {
          assert.equal(
            kind,
            "plan",
            "No answer call should run without evidence.",
          );
          return {
            query: "xylophonic nebulizer quasar",
            caseId: null,
            related: false,
            clarification: "",
            candidates: [],
          };
        },
      },
    );
    assert.equal(noMatch.turns.at(-1)?.status, "ready");
    assert.equal(noMatch.turns.at(-1)?.work?.retrieval.cases.length, 0);
    assert.equal(noMatch.turns.at(-1)?.answer?.sections[0].kind, "unknown");

    delete process.env.OPENAI_API_KEY;
    const fallback = await processQueryTurn(
      query.id,
      {
        requestKey: randomUUID(),
        message: "manager approval",
        scope: "case",
        caseId: first,
      },
      a.id,
      {
        model: async () => {
          throw new Error("No provider call is allowed without configuration.");
        },
        embedder: async () => {
          throw new Error("Semantic search unavailable");
        },
      },
    );
    assert.equal(fallback.turns.at(-1)?.status, "failed");
    assert.equal(fallback.turns.at(-1)?.work?.retrieval.mode, "keyword");
    assert.ok(fallback.turns.at(-1)?.work?.evidence.length);
    process.env.OPENAI_API_KEY = "test-mocked-key";

    const sources = await db
      .from("source_documents")
      .select("id")
      .eq("case_id", first);
    await db
      .from("source_documents")
      .update({ version: 2 })
      .eq("id", sources.data?.[0].id);
    const changed = await queryDetail(query.id, a.id);
    assert.ok(changed.turns[0].work?.evidence.some((item) => item.stale));
    const fallbackTurn = fallback.turns.at(-1);
    assert.ok(fallbackTurn);
    const refreshed = await processQueryTurn(
      query.id,
      {
        requestKey: fallbackTurn.id,
        message: fallbackTurn.message,
        scope: "case",
        caseId: first,
      },
      a.id,
      deps,
    );
    assert.equal(refreshed.turns.at(-1)?.status, "ready");
    assert.ok(
      refreshed.turns
        .at(-1)
        ?.work?.evidence.every((item) => item.version === 2 && !item.stale),
    );

    const created = await fetch(`${base}/api/queries`, {
      method: "POST",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        requestKey: randomUUID(),
        request: "API query creation",
        technology: "React",
      }),
    });
    assert.equal(created.status, 201, await created.clone().text());
    assert.equal((await created.json()).query.request.technology, "React");
    const invalid = await fetch(`${base}/api/queries`, {
      method: "POST",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ requestKey: randomUUID(), request: " " }),
    });
    assert.equal(invalid.status, 400);

    await db
      .from("demo_sessions")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", a.id);
    assert.equal(
      (
        await fetch(`${base}/api/queries/${query.id}`, {
          headers: { Cookie: a.cookie },
        })
      ).status,
      401,
    );
  } finally {
    for (const [key, value] of Object.entries({
      OPENAI_API_KEY: oldKey,
      AI_CHAT_SESSION_LIMIT: oldSessionLimit,
      AI_CHAT_DAILY_LIMIT: oldDailyLimit,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await db.from("demo_sessions").delete().in("id", sessions);
  }
});
