import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadSampleCatalog } from "../scripts/sample-catalog";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";
import { clarificationPlan } from "../src/features/plans/content";
import type { Evidence } from "../src/features/queries/types";

mock.module("server-only", () => ({}));
const { createQuery, updateChatContext } =
  await import("../src/features/queries/server/repository");
const { processAssistantTurn } =
  await import("../src/features/queries/server/process-assistant");
const { retrieveAssistant } =
  await import("../src/features/queries/server/assistant-retrieval");
const { createPlan } = await import("../src/features/plans/server/repository");
const { processPlan } = await import("../src/features/plans/server/process");
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("demo library discovers nine projects, excludes private and retired records, and survives plan generation", async () => {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const catalog = await loadSampleCatalog();
  const ids = new Set(catalog.map((c) => c.id));
  const token = newSessionToken();
  const owner = await db
    .from("demo_sessions")
    .insert({ token_hash: hashSessionToken(token) })
    .select("id")
    .single();
  assert.ifError(owner.error);
  const sessionId = owner.data.id;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "mock-demo-library";
  const retiredId = randomUUID();
  const privateId = randomUUID();
  const keyword = async (): Promise<number[][]> => {
    throw new Error("mock keyword fallback");
  };
  try {
    for (const [id, sample] of [
      [retiredId, true],
      [privateId, false],
    ] as const) {
      assert.ifError(
        (
          await db.from("cases").insert({
            id,
            request_key: id,
            title: "Threadline request history",
            status: "ready",
            is_seed: sample,
            session_id: sample ? null : sessionId,
            sample_visible: false,
          })
        ).error,
      );
      const source = randomUUID();
      const text =
        "Threadline request review history private or retired sentinel.";
      assert.ifError(
        (
          await db.from("source_documents").insert({
            id: source,
            case_id: id,
            title: "sentinel.md",
            format: "md",
            original_text: text,
            extracted_text: text,
            status: "ready",
          })
        ).error,
      );
      assert.ifError(
        (
          await db.from("source_chunks").insert({
            source_id: source,
            ordinal: 0,
            char_start: 0,
            char_end: text.length,
            text,
          })
        ).error,
      );
    }
    let query = await createQuery(
      {
        requestKey: randomUUID(),
        request: "Review request history",
        assistant: true,
        chatContext: { mode: "samples", caseIds: [] },
      },
      sessionId,
    );
    const turnId = randomUUID();
    query = await processAssistantTurn(
      query.id,
      {
        requestKey: turnId,
        message: "Review request history",
        contextRevision: 0,
      },
      sessionId,
      {
        embedder: keyword,
        model: async (kind, input) => {
          const payload = input as {
            catalog: { id: string }[];
            evidence?: Evidence[];
          };
          assert.deepEqual(new Set(payload.catalog.map((c) => c.id)), ids);
          if (kind === "assistant_plan")
            return {
              intent: "search",
              queries: ["Threadline request review history"],
              caseIds: [...ids].slice(0, 3),
              reply: "",
            };
          if (kind === "assistant_review") return { query: "" };
          assert.ok(payload.evidence?.length);
          assert.deepEqual(
            new Set(payload.evidence.map((e) => e.case_id)),
            ids,
          );
          return {
            sections: [
              {
                kind: "fact",
                heading: "",
                text: "The fictional collection records project decisions.",
                evidence: [payload.evidence[0].id],
              },
            ],
          };
        },
      },
    );
    assert.equal(query.turns[0].status, "ready");
    assert.equal(query.turns[0].context_snapshot?.mode, "samples");
    assert.equal(
      new Set(query.turns[0].work?.evidence.map((e) => e.case_id)).size,
      9,
    );
    const restored = await fetch(`${base}/api/queries/${query.id}`, {
      headers: { Cookie: `rewoven-session=${token}` },
    });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).query.chat_context.mode, "samples");
    const rejected = await retrieveAssistant(
      ["Threadline"],
      { mode: "samples", caseIds: [] },
      [privateId, retiredId],
      sessionId,
      keyword,
    );
    assert.deepEqual(rejected.passages, []);
    const privateOnly = await retrieveAssistant(
      ["Threadline"],
      { mode: "library", caseIds: [] },
      [],
      sessionId,
      keyword,
    );
    assert.ok(privateOnly.passages.length);
    assert.ok(privateOnly.passages.every((p) => p.case_id === privateId));

    const plan = await createPlan(
      query.id,
      { requestKey: randomUUID(), contextRevision: 0 },
      sessionId,
    );
    assert.equal(plan.snapshot.context.mode, "samples");
    const brief = {
      title: "Northbank purchasing",
      request: "Request review history and revision checks",
      deadline: "Four weeks",
      technology: "Next.js and PostgreSQL",
      capabilities: "",
      questions: "Who assigns finance reviewers?",
    };
    await processPlan(plan.id, "prepare", {}, sessionId, {
      model: async () => brief,
    });
    const ready = await processPlan(plan.id, "generate", brief, sessionId, {
      retrieve: (queries, context, narrowed, session) =>
        retrieveAssistant(queries, context, narrowed, session, keyword),
      model: async (_kind, input) => {
        const evidence = (input as { evidence: Evidence[] }).evidence;
        assert.ok(evidence.length);
        assert.ok(evidence.every((e) => ids.has(e.case_id)));
        const generated = clarificationPlan();
        generated.kind = "reuse";
        generated.sections[0].items[0] = {
          kind: "fact",
          text: "The history records request review decisions.",
          evidence: [evidence[0].id],
        };
        return generated;
      },
    });
    assert.equal(ready.status, "ready");
    assert.equal(ready.snapshot.context.mode, "samples");
    const changed = await updateChatContext(
      query.id,
      { contextRevision: 0, chatContext: { mode: "library", caseIds: [] } },
      sessionId,
    );
    assert.equal(changed.chat_context?.mode, "library");
    assert.equal(changed.turns[0].context_snapshot?.mode, "samples");
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    await db.from("cases").delete().eq("id", retiredId);
    await db.from("demo_sessions").delete().eq("id", sessionId);
  }
}, 30000);
