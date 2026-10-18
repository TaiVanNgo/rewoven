import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { emptyOverview } from "../src/features/cases/case-overview";
import { caseFields } from "../src/features/cases/case-reading";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";
import { conversationContext } from "../src/features/queries/context";
import type {
  ChatContext,
  Evidence,
  QueryWork,
} from "../src/features/queries/types";

mock.module("server-only", () => ({}));
const { cleanupDeletedCases, deleteCase } =
  await import("../src/features/cases/server/deletion");
const { createCaseShell, processSource } =
  await import("../src/features/cases/server/sources");
const { caseDetail } = await import("../src/features/cases/server/repository");
const { queryDetail, updateChatContext } =
  await import("../src/features/queries/server/repository");
const { processAssistantTurn } =
  await import("../src/features/queries/server/process-assistant");
const { retrieveAssistant } =
  await import("../src/features/queries/server/assistant-retrieval");
const { planDetail } = await import("../src/features/plans/server/repository");
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const vector = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
const draft = {
  request: "Review the narwhal approval workflow.",
  deadline: "",
  technology: "",
  capabilities: "",
};
const keyword = async (): Promise<number[][]> => {
  throw new Error("No paid embedding calls in tests");
};

async function fixture() {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const sessions: string[] = [],
    cases: string[] = [],
    paths: string[] = [];
  async function session() {
    const token = newSessionToken();
    const r = await db
      .from("demo_sessions")
      .insert({ token_hash: hashSessionToken(token) })
      .select("id")
      .single();
    assert.ifError(r.error);
    sessions.push(r.data.id);
    return { id: r.data.id as string, cookie: `rewoven-session=${token}` };
  }
  async function addCase(sessionId: string, files = 1, sample = false) {
    const id = randomUUID();
    cases.push(id);
    const overview = emptyOverview();
    overview.sections.summary = [
      {
        id: "summary",
        text: "A narwhal approval workflow.",
        origin: "user",
        evidence: [],
      },
    ];
    assert.ifError(
      (
        await db.from("cases").insert({
          id,
          request_key: id,
          session_id: sample ? null : sessionId,
          is_seed: sample,
          title: "Deletion fixture",
          context: "A narwhal approval workflow.",
          status: "ready",
          overview,
        })
      ).error,
    );
    const evidence: Evidence[] = [];
    const signed: { path: string; token: string }[] = [];
    for (let i = 0; i < files; i++) {
      const sourceId = randomUUID(),
        chunkId = randomUUID();
      const text = `Narwhal approval document ${i}: the pilot recorded 20 approvals.`;
      const path = `${sessionId}/${id}/${sourceId}/source.md`;
      paths.push(path);
      const upload = await db.storage
        .from("case-sources")
        .createSignedUploadUrl(path);
      assert.ifError(upload.error);
      signed.push({ path, token: upload.data.token });
      assert.ifError(
        (
          await db.storage
            .from("case-sources")
            .uploadToSignedUrl(path, upload.data.token, text, {
              contentType: "text/markdown",
            })
        ).error,
      );
      assert.ifError(
        (
          await db.from("source_documents").insert({
            id: sourceId,
            case_id: id,
            title: `source-${i}.md`,
            format: "md",
            storage_path: path,
            extracted_text: text,
            byte_size: text.length,
            char_count: text.length,
            pages: [{ number: 1, text }],
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
            embedding: JSON.stringify(vector),
            embedding_model: "text-embedding-3-small",
          })
        ).error,
      );
      evidence.push({
        id: `e${i + 1}`,
        chunk_id: chunkId,
        source_id: sourceId,
        case_id: id,
        title: "Deletion fixture",
        source_title: `source-${i}.md`,
        version: 1,
        page_number: null,
        char_start: 0,
        char_end: text.length,
        text,
        outcome: "",
        score: 1,
      });
    }
    return { id, evidence, signed };
  }
  async function chat(
    sessionId: string,
    context: ChatContext,
    evidence: Evidence[] = [],
  ) {
    const id = randomUUID(),
      turnId = randomUUID();
    assert.ifError(
      (
        await db.from("query_conversations").insert({
          id,
          session_id: sessionId,
          title: "Deletion chat",
          request: draft,
          assistant: true,
          chat_context: context,
          focused_case_id: context.caseIds[0] ?? null,
        })
      ).error,
    );
    const work: QueryWork = {
      searchQuery: "narwhal",
      focusTitle: "Deletion fixture",
      focus: { scope: "library", caseId: null },
      clarification: "",
      candidates: [],
      retrieval: { cases: [], mode: "keyword", warnings: [] },
      evidence,
    };
    assert.ifError(
      (
        await db.from("query_turns").insert({
          id: turnId,
          conversation_id: id,
          ordinal: 1,
          message: draft.request,
          scope: "library",
          status: "ready",
          context_snapshot: context,
          work,
          answer: {
            sections: [
              {
                kind: "fact",
                heading: "Result",
                text: "The pilot recorded 20 approvals.",
                evidence: evidence.map((e) => e.id),
              },
            ],
          },
        })
      ).error,
    );
    return { id, turnId, work };
  }
  return {
    session,
    addCase,
    chat,
    async close() {
      await db.storage.from("case-sources").remove(paths);
      await db.from("demo_sessions").delete().in("id", sessions);
      await db.from("cases").delete().in("id", cases);
      await db.from("case_deletions").delete().in("case_id", cases);
    },
  };
}
async function request(
  path: string,
  cookie: string,
  method: string,
  body?: unknown,
  origin = base,
) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("case edits preserve embeddings; permanent deletion cascades, retains history, and requires scope recovery", async () => {
  const f = await fixture();
  try {
    const owner = await f.session(),
      outsider = await f.session();
    const a = await f.addCase(owner.id, 2),
      b = await f.addCase(owner.id);
    const sample = await f.addCase(owner.id, 1, true);
    const readingId = randomUUID();
    assert.ifError(
      (
        await db.from("case_ai_readings").insert({
          id: readingId,
          session_id: owner.id,
          case_id: a.id,
          source_hash: readingId,
          model: "deletion-fixture",
          prompt_version: 1,
          status: "processing",
        })
      ).error,
    );
    assert.ifError(
      (
        await db.from("case_ai_reviews").insert({
          case_id: a.id,
          source_id: a.evidence[0].source_id,
          reading_id: readingId,
        })
      ).error,
    );
    const context: ChatContext = { mode: "selected", caseIds: [a.id] };
    const chat = await f.chat(owner.id, context, a.evidence);
    const mixed = await f.chat(owner.id, {
      mode: "selected",
      caseIds: [a.id, b.id],
    });
    const planId = randomUUID();
    assert.ifError(
      (
        await db.from("reuse_plans").insert({
          id: planId,
          session_id: owner.id,
          conversation_id: chat.id,
          title: "Saved deletion plan",
          snapshot: { context },
          status: "ready",
          evidence: a.evidence,
          saved_markdown: "Historical plan text",
          saved_at: new Date().toISOString(),
        })
      ).error,
    );
    const before = await caseDetail(a.id, owner.id);
    const beforeChunks = await db
      .from("source_chunks")
      .select("id,embedding")
      .in(
        "source_id",
        a.evidence.map((e) => e.source_id),
      )
      .order("id");
    assert.ok(before.overview);
    const overview = structuredClone(before.overview);
    overview.sections.summary[0].text = "An edited narwhal approval workflow.";
    const edited = await request(`/api/cases/${a.id}`, owner.cookie, "PATCH", {
      fields: { ...caseFields(before), title: "Edited case" },
      expected: caseFields(before),
      overview,
      expectedOverviewRevision: before.overviewRevision,
    });
    assert.equal(edited.status, 200, await edited.text());
    const afterChunks = await db
      .from("source_chunks")
      .select("id,embedding")
      .in(
        "source_id",
        a.evidence.map((e) => e.source_id),
      )
      .order("id");
    assert.deepEqual(afterChunks.data, beforeChunks.data);
    const stale = await request(`/api/cases/${a.id}`, owner.cookie, "PATCH", {
      fields: caseFields(before),
      expected: caseFields(before),
      overview,
      expectedOverviewRevision: before.overviewRevision,
    });
    assert.equal(stale.status, 409);
    assert.equal(
      (await request(`/api/cases/${a.id}`, outsider.cookie, "DELETE")).status,
      404,
    );
    assert.equal(
      (await request(`/api/cases/${sample.id}`, owner.cookie, "DELETE")).status,
      403,
    );
    assert.equal(
      (
        await request(
          `/api/cases/${a.id}`,
          owner.cookie,
          "DELETE",
          undefined,
          "https://other.example",
        )
      ).status,
      403,
    );
    assert.equal(
      (await request("/api/cases/not-a-uuid", owner.cookie, "DELETE")).status,
      400,
    );
    const deleted = await request(`/api/cases/${a.id}`, owner.cookie, "DELETE");
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), {
      deleted: true,
      cleanupPending: true,
    });
    for (const [table, column, values] of [
      ["cases", "id", [a.id]],
      ["source_documents", "case_id", [a.id]],
      ["source_chunks", "source_id", a.evidence.map((e) => e.source_id)],
      ["case_ai_readings", "id", [readingId]],
      ["case_ai_reviews", "case_id", [a.id]],
    ] as const) {
      const r = await db.from(table).select(column).in(column, values);
      assert.ifError(r.error);
      assert.equal(r.data?.length, 0);
    }
    for (const file of a.signed)
      assert.ok(
        (await db.storage.from("case-sources").download(file.path)).error,
      );
    const intact = await db
      .from("source_chunks")
      .select("embedding")
      .eq("id", b.evidence[0].chunk_id)
      .single();
    assert.ifError(intact.error);
    assert.deepEqual(JSON.parse(intact.data.embedding), vector);
    const restored = await queryDetail(chat.id, owner.id);
    assert.deepEqual(restored.chat_context, { mode: "selected", caseIds: [] });
    assert.equal(restored.context_revision, 1);
    assert.equal(restored.focused_case_id, null);
    assert.equal(restored.turns[0].work?.evidence[0].stale, true);
    assert.equal(
      restored.turns[0].answer?.sections[0].text,
      "The pilot recorded 20 approvals.",
    );
    const history = conversationContext(restored, {
      ...restored.turns[0],
      ordinal: 2,
    });
    assert.deepEqual(history.history[0].answer, []);
    const restoredPlan = await planDetail(planId, owner.id);
    assert.equal(restoredPlan.saved_markdown, "Historical plan text");
    assert.ok(restoredPlan.evidence.every((e) => e.stale));
    assert.deepEqual(
      (await queryDetail(mixed.id, owner.id)).chat_context?.caseIds,
      [b.id],
    );
    await assert.rejects(
      processAssistantTurn(
        chat.id,
        { requestKey: randomUUID(), message: "Continue", contextRevision: 1 },
        owner.id,
      ),
      /Choose cases or search full library/,
    );
    await assert.rejects(
      retrieveAssistant(
        ["narwhal"],
        { mode: "selected", caseIds: [] },
        [],
        owner.id,
        keyword,
      ),
      /Choose cases or search full library/,
    );
    const retrieved = await retrieveAssistant(
      ["narwhal"],
      { mode: "library", caseIds: [] },
      [],
      owner.id,
      keyword,
    );
    assert.ok(retrieved.passages.every((p) => p.case_id !== a.id));
    await updateChatContext(
      chat.id,
      { chatContext: { mode: "library", caseIds: [] }, contextRevision: 1 },
      owner.id,
    );
    assert.equal(
      (await queryDetail(chat.id, owner.id)).chat_context?.mode,
      "library",
    );
    assert.equal(
      (await request(`/api/cases/${a.id}`, owner.cookie, "DELETE")).status,
      200,
    );
    assert.equal(
      (await request(`/api/cases/${a.id}`, outsider.cookie, "DELETE")).status,
      404,
    );
    await assert.rejects(
      createCaseShell({ requestKey: a.id, title: "Resurrect" }, owner.id),
      /permanently deleted/,
    );
    // A URL issued before deletion can still upload: force the scheduled final
    // sweep due instead of waiting two hours, then verify it removes that file.
    assert.ifError(
      (
        await db.storage
          .from("case-sources")
          .uploadToSignedUrl(
            a.signed[0].path,
            a.signed[0].token,
            "Late upload",
            { contentType: "text/markdown" },
          )
      ).error,
    );
    assert.ifError(
      (
        await db
          .from("case_deletions")
          .update({
            final_sweep_at: "2000-01-01",
            next_attempt_at: "2000-01-01",
          })
          .eq("case_id", a.id)
      ).error,
    );
    assert.equal(
      (await request("/api/cases/cleanup", outsider.cookie, "POST")).status,
      200,
    );
    assert.ifError(
      (await db.storage.from("case-sources").download(a.signed[0].path)).error,
    );
    const sweep = await request("/api/cases/cleanup", owner.cookie, "POST");
    assert.equal(sweep.status, 200);
    assert.ok((await sweep.json()).attempted >= 1);
    assert.ok(
      (await db.storage.from("case-sources").download(a.signed[0].path)).error,
    );
    assert.deepEqual(
      await (
        await request(`/api/cases/${a.id}`, owner.cookie, "DELETE")
      ).json(),
      { deleted: true, cleanupPending: false },
    );
    assert.ifError(
      (
        await db
          .from("demo_sessions")
          .update({ expires_at: "2000-01-01" })
          .eq("id", owner.id)
      ).error,
    );
    assert.equal(
      (await request(`/api/cases/${b.id}`, owner.cookie, "DELETE")).status,
      401,
    );
    assert.equal(
      (await request("/api/cases/cleanup", owner.cookie, "POST")).status,
      401,
    );
    assert.equal(
      (await db.rpc("delete_owned_case", { p_case: b.id, p_session: owner.id }))
        .data,
      "expired",
    );
  } finally {
    await f.close();
  }
}, 30000);

test("cleanup survives Storage failure and session removal; processing cannot restore deleted chunks", async () => {
  const f = await fixture();
  try {
    const owner = await f.session();
    const a = await f.addCase(owner.id);
    const result = await deleteCase(a.id, owner.id, async () => {
      throw new Error("Storage offline");
    });
    assert.deepEqual(result, { deleted: true, cleanupPending: true });
    const receipt = await db
      .from("case_deletions")
      .select("*")
      .eq("case_id", a.id)
      .single();
    assert.match(receipt.data.last_error, /another attempt/);
    assert.ifError(
      (await db.storage.from("case-sources").download(a.signed[0].path)).error,
    );
    const b = await f.addCase(owner.id);
    await db
      .from("source_chunks")
      .update({ embedding: null })
      .eq("id", b.evidence[0].chunk_id);
    await db
      .from("source_documents")
      .update({ indexing_status: "pending" })
      .eq("id", b.evidence[0].source_id);
    await processSource(b.evidence[0].source_id, owner.id, false, async () => {
      await deleteCase(b.id, owner.id);
      return [vector];
    });
    assert.equal(
      (
        await db
          .from("source_chunks")
          .select("id")
          .eq("id", b.evidence[0].chunk_id)
      ).data?.length,
      0,
    );
    assert.equal(
      (
        await db.rpc("save_source_stage", {
          p_id: b.evidence[0].source_id,
          p_token: randomUUID(),
          p_pages: [],
          p_warnings: [],
          p_cursor: 0,
          p_count: 0,
          p_complete: true,
          p_chunks: [],
        })
      ).data,
      false,
    );
    // Cleanup receipts have no session FK, so maintenance can finish after the
    // anonymous session itself has been removed.
    assert.ifError(
      (await db.from("demo_sessions").delete().eq("id", owner.id)).error,
    );
    assert.ifError(
      (
        await db
          .from("case_deletions")
          .update({
            final_sweep_at: "2000-01-01",
            next_attempt_at: "2000-01-01",
          })
          .eq("case_id", a.id)
      ).error,
    );
    const sweep = await cleanupDeletedCases(null);
    assert.equal(sweep.failed, 0);
    const cleaned = await db
      .from("case_deletions")
      .select("cleanup_complete,storage_paths")
      .eq("case_id", a.id)
      .single();
    assert.deepEqual(cleaned.data, {
      cleanup_complete: true,
      storage_paths: [],
    });
    assert.ok(
      (await db.storage.from("case-sources").download(a.signed[0].path)).error,
    );
  } finally {
    await f.close();
  }
}, 30000);

test("database publication guards reject deleted evidence for answers and plans", async () => {
  const f = await fixture();
  try {
    const owner = await f.session(),
      a = await f.addCase(owner.id);
    const chat = await f.chat(
      owner.id,
      { mode: "library", caseIds: [] },
      a.evidence,
    );
    const pendingTurn = randomUUID(),
      planId = randomUUID();
    assert.ifError(
      (
        await db.from("query_turns").insert({
          id: pendingTurn,
          conversation_id: chat.id,
          ordinal: 2,
          message: "More",
          scope: "library",
          status: "processing",
          work: chat.work,
        })
      ).error,
    );
    assert.ifError(
      (
        await db.from("reuse_plans").insert({
          id: planId,
          session_id: owner.id,
          conversation_id: chat.id,
          title: "In flight",
          snapshot: { context: { mode: "library", caseIds: [] } },
          status: "generating",
          evidence: a.evidence,
        })
      ).error,
    );
    await deleteCase(a.id, owner.id);
    const answer = await db
      .from("query_turns")
      .update({ status: "ready", answer: { sections: [] } })
      .eq("id", pendingTurn);
    assert.match(answer.error?.message ?? "", /Sources changed/);
    const plan = await db
      .from("reuse_plans")
      .update({ status: "ready" })
      .eq("id", planId);
    assert.match(plan.error?.message ?? "", /Sources changed/);
    assert.equal(
      (
        await db
          .from("query_turns")
          .select("status")
          .eq("id", pendingTurn)
          .single()
      ).data?.status,
      "processing",
    );
    assert.equal(
      (await db.from("reuse_plans").select("status").eq("id", planId).single())
        .data?.status,
      "generating",
    );
  } finally {
    await f.close();
  }
}, 30000);
