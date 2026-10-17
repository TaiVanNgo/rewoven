import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";
import type {
  RequestDocumentContext,
  RequestEvidence,
  RequestFinding,
} from "../src/features/query-files/types";

mock.module("server-only", () => ({}));
const { createQuery, queryDetail } =
  await import("../src/features/queries/server/repository");
const {
  ownedQueryFile,
  reserveQueryFiles,
  queryFileUpload,
  completeQueryFile,
  processQueryFile,
  requestDocumentContext,
  toggleQueryFile,
  queryFilePreview,
} = await import("../src/features/query-files/server/repository");
const { processAssistantTurn } =
  await import("../src/features/queries/server/process-assistant");
const { createPlan } = await import("../src/features/plans/server/repository");
const { processPlan } = await import("../src/features/plans/server/process");
const { exportMarkdown, clarificationPlan } =
  await import("../src/features/plans/content");
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);
test("query documents upload, resume full readings, isolate evidence, snapshot turns and survive plans/export", async () => {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const sessions: string[] = [],
    paths: string[] = [];
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "mock-file-test-key";
  let calls = 0;
  const reader = async (_kind: string, input: unknown) => {
    calls++;
    const data = input as {
      excerpts?: RequestEvidence[];
      findings?: RequestFinding[];
    };
    if (data.findings) return { findings: data.findings.slice(-12) };
    const passage = data.excerpts?.at(-1);
    assert.ok(passage);
    return {
      findings: [
        {
          kind: "requirement",
          text: passage.text.includes("TAIL_REQUIREMENT")
            ? "TAIL_REQUIREMENT: two approvals by Friday."
            : "The document describes a new approval project.",
          evidence: [passage.id],
        },
      ],
    };
  };
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
  async function upload(id: string, owner: string, bytes: Uint8Array) {
    const file = await ownedQueryFile(id, owner);
    paths.push(file.storage_path);
    const { uploadUrl } = await queryFileUpload(id, owner);
    assert.ok(uploadUrl);
    const result = await fetch(uploadUrl, {
      method: "PUT",
      body: Buffer.from(bytes),
    });
    assert.equal(result.ok, true, await result.text());
    await completeQueryFile(id, owner);
  }
  async function finish(id: string, owner: string) {
    for (let i = 0; i < 70; i++) {
      const f = await ownedQueryFile(id, owner);
      if (f.status === "ready") return f;
      await processQueryFile(id, owner, true, { model: reader });
    }
    throw new Error("Reading did not converge");
  }
  try {
    const a = await session(),
      b = await session();
    const long = new TextEncoder().encode(
      "approval background ".repeat(15000) +
        "\nTAIL_REQUIREMENT: Two approvals by Friday.",
    );
    const one = randomUUID(),
      two = randomUUID();
    let query = await createQuery(
      {
        requestKey: randomUUID(),
        request: "",
        assistant: true,
        files: [
          { id: one, title: "requirements.md", size: long.length },
          {
            id: two,
            title: "constraints.txt",
            size: new TextEncoder().encode("Use PostgreSQL for all data.\n")
              .length,
          },
        ],
      },
      a.id,
    );
    assert.equal(query.files?.length, 2);
    assert.match(query.request.request, /Analyze the uploaded problem/);
    await assert.rejects(ownedQueryFile(one, b.id));
    await assert.rejects(
      createQuery(
        {
          requestKey: query.id,
          request: query.request.request,
          assistant: true,
          files: [{ id: one, title: "different.txt", size: 1 }],
        },
        b.id,
      ),
    );
    await assert.rejects(
      processAssistantTurn(
        query.id,
        {
          requestKey: randomUUID(),
          message: "Analyze",
          contextRevision: query.context_revision,
        },
        a.id,
      ),
      /Finish reading/,
    );
    await upload(one, a.id, long);
    await upload(
      two,
      a.id,
      new TextEncoder().encode("Use PostgreSQL for all data.\n"),
    );
    await processQueryFile(one, a.id, true, { model: reader });
    await processQueryFile(one, a.id, true, { model: reader });
    const checkpoint = await ownedQueryFile(one, a.id);
    assert.ok(checkpoint.cursor > 0 && checkpoint.cursor < checkpoint.total);
    const beforeCalls = calls;
    await processQueryFile(one, a.id, true, {
      model: async () => {
        throw new Error("Simulated timeout");
      },
    });
    assert.equal((await ownedQueryFile(one, a.id)).cursor, checkpoint.cursor);
    const ready = await finish(one, a.id);
    await finish(two, a.id);
    assert.equal(ready.char_count, new TextDecoder().decode(long).length);
    assert.ok(calls > beforeCalls);
    const cached = calls;
    await processQueryFile(one, a.id, true, { model: reader });
    assert.equal(calls, cached);
    const context = await requestDocumentContext(
      [one, two],
      a.id,
      "TAIL_REQUIREMENT approvals Friday PostgreSQL",
    );
    assert.ok(
      context.evidence.some((e) => e.text.includes("TAIL_REQUIREMENT")),
    );
    assert.ok(
      context.documents[0].findings.some((f) =>
        f.text.includes("TAIL_REQUIREMENT"),
      ),
    );
    const tail = context.evidence.find((e) =>
      e.text.includes("TAIL_REQUIREMENT"),
    );
    assert.ok(tail);
    const preview = await queryFilePreview(
      one,
      a.id,
      new URLSearchParams({
        page: "1",
        start: String(tail.start),
        end: String(tail.end),
        quote: tail.text,
        version: "1",
      }),
    );
    assert.ok(preview.highlight);
    let answerInput: { requestDocuments: RequestDocumentContext } | undefined;
    const assistant = {
      model: async (kind: string, input: unknown) => {
        if (kind === "assistant_plan")
          return {
            intent: "search",
            queries: ["approval requirements"],
            caseIds: [],
            reply: "",
          };
        if (kind === "assistant_review") return { query: "" };
        answerInput = input as { requestDocuments: RequestDocumentContext };
        return {
          sections: [
            {
              kind: "fact",
              heading: "",
              text: "Your request requires two approvals; no historical precedent was found.",
              evidence: [answerInput.requestDocuments.evidence[0].id],
            },
          ],
        };
      },
      embedder: async () => {
        throw new Error("keyword only fixture");
      },
    };
    query = await processAssistantTurn(
      query.id,
      {
        requestKey: randomUUID(),
        message: "",
        contextRevision: query.context_revision,
      },
      a.id,
      assistant,
    );
    assert.equal(query.turns.at(-1)?.status, "ready");
    assert.equal(query.turns.at(-1)?.request_file_ids?.length, 2);
    assert.equal(query.turns.at(-1)?.new_file_ids?.length, 2);
    assert.equal(query.turns.at(-1)?.work?.evidence.length, 0);
    assert.ok(query.turns.at(-1)?.work?.requestEvidence?.length);
    const reply = query.turns.at(-1);
    assert.ok(reply);
    const plan = await createPlan(
      query.id,
      { requestKey: randomUUID(), contextRevision: query.context_revision },
      a.id,
    );
    assert.equal(plan.snapshot.requestDocuments?.documents.length, 2);
    const brief = {
      title: "Approval delivery",
      request: "Build two-stage approvals by Friday",
      deadline: "Friday",
      technology: "PostgreSQL",
      capabilities: "",
      questions: "",
    };
    await processPlan(plan.id, "prepare", {}, a.id, {
      model: async () => brief,
    });
    const generated = await processPlan(plan.id, "generate", brief, a.id, {
      model: async () => clarificationPlan(),
      retrieve: async () => ({ passages: [], mode: "keyword", warnings: [] }),
    });
    assert.equal(generated.status, "ready");
    assert.ok(generated.request_evidence?.length);
    const exported = exportMarkdown(
      {
        ...generated,
        saved_markdown: generated.generated_markdown,
        saved_at: new Date().toISOString(),
      },
      "http://localhost:3000",
    );
    assert.match(exported, /Request document references/);
    assert.ok(exported.includes("TAIL\\_REQUIREMENT"));
    assert.match(exported, /\/api\/query-files\//);
    await toggleQueryFile(
      one,
      { enabled: false, contextRevision: query.context_revision },
      a.id,
    );
    query = await queryDetail(query.id, a.id);
    assert.deepEqual(
      query.turns.at(-1)?.request_file_ids,
      reply.request_file_ids,
    );
    const replay = await processAssistantTurn(
      query.id,
      { requestKey: reply.id, message: reply.message, contextRevision: 0 },
      a.id,
      assistant,
    );
    assert.equal(replay.turns.length, 1);
    query = await processAssistantTurn(
      query.id,
      {
        requestKey: randomUUID(),
        message: "Review the remaining file",
        contextRevision: query.context_revision,
      },
      a.id,
      assistant,
    );
    assert.deepEqual(query.turns.at(-1)?.request_file_ids, [two]);
    const bad = randomUUID();
    const pdf = await readFile("tests/fixtures/mixed-pages.pdf");
    await reserveQueryFiles(
      query.id,
      [{ id: bad, title: "mixed.pdf", size: pdf.length }],
      a.id,
    );
    await upload(bad, a.id, pdf);
    await finish(bad, a.id);
    query = await queryDetail(query.id, a.id);
    assert.ok(query.files?.find((f) => f.id === bad)?.warnings.length);
    await assert.rejects(
      processAssistantTurn(
        query.id,
        {
          requestKey: randomUUID(),
          message: "Compare",
          contextRevision: query.context_revision,
        },
        a.id,
        assistant,
      ),
      /Finish reading/,
    );
    await assert.rejects(
      requestDocumentContext([bad], a.id, "compare"),
      /incomplete/,
    );
    await toggleQueryFile(
      bad,
      { enabled: false, contextRevision: query.context_revision },
      a.id,
    );
    const api = await fetch(
      `${process.env.TEST_BASE_URL ?? "http://localhost:3000"}/api/query-files/${one}/original`,
      { headers: { cookie: b.cookie } },
    );
    assert.equal(api.status, 404);
    const original = await fetch(
      `${process.env.TEST_BASE_URL ?? "http://localhost:3000"}/api/query-files/${one}/original`,
      { headers: { cookie: a.cookie } },
    );
    assert.equal(original.status, 200);
    assert.equal((await original.text()).length, long.length);

    // Database locks protect concurrent reservations, independently of browser validation.
    const quota = await createQuery(
      { requestKey: randomUUID(), request: "Quota fixture", assistant: true },
      a.id,
    );
    const fixtures = Array.from({ length: 19 }, (_, i) => ({
      id: randomUUID(),
      conversation_id: quota.id,
      session_id: a.id,
      title: `retained-${i}.txt`,
      format: "txt",
      byte_size: 5_000_000,
      storage_path: `quota/${randomUUID()}`,
      enabled: false,
      status: "ready",
    }));
    assert.ifError((await db.from("query_files").insert(fixtures)).error);
    const reservations = await Promise.allSettled(
      [0, 1].map((i) =>
        reserveQueryFiles(
          quota.id,
          [{ id: randomUUID(), title: `boundary-${i}.txt`, size: 5_000_000 }],
          a.id,
        ),
      ),
    );
    assert.equal(
      reservations.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal((await queryDetail(quota.id, a.id)).files?.length, 20);
    const pending = await createQuery(
      { requestKey: randomUUID(), request: "Pending fixture", assistant: true },
      a.id,
    );
    const manifests = Array.from({ length: 5 }, () => ({
      id: randomUUID(),
      title: "pending.txt",
      size: 1,
    }));
    await reserveQueryFiles(pending.id, manifests, a.id);
    let pendingChat = await queryDetail(pending.id, a.id);
    await toggleQueryFile(
      manifests[0].id,
      { enabled: false, contextRevision: pendingChat.context_revision },
      a.id,
    );
    await reserveQueryFiles(
      pending.id,
      [{ id: randomUUID(), title: "replacement.txt", size: 1 }],
      a.id,
    );
    pendingChat = await queryDetail(pending.id, a.id);
    await assert.rejects(
      toggleQueryFile(
        manifests[0].id,
        { enabled: true, contextRevision: pendingChat.context_revision },
        a.id,
      ),
      /pending files/,
    );
    const textQuota = await createQuery(
      {
        requestKey: randomUUID(),
        request: "Text quota fixture",
        assistant: true,
      },
      a.id,
    );
    assert.ifError(
      (
        await db.from("query_files").insert(
          Array.from({ length: 10 }, () => ({
            id: randomUUID(),
            conversation_id: textQuota.id,
            session_id: a.id,
            title: "retained.txt",
            format: "txt",
            byte_size: 1,
            char_count: 500_000,
            storage_path: `quota/${randomUUID()}`,
            enabled: false,
            status: "ready",
          })),
        )
      ).error,
    );
    const extra = randomUUID(),
      token = randomUUID();
    await reserveQueryFiles(
      textQuota.id,
      [{ id: extra, title: "excess.txt", size: 1 }],
      a.id,
    );
    assert.ifError(
      (
        await db
          .from("query_files")
          .update({ status: "extracting", processing_token: token })
          .eq("id", extra)
      ).error,
    );
    const saved = await db.rpc("save_query_file_stage", {
      p_session: a.id,
      p_id: extra,
      p_token: token,
      p_patch: { char_count: 1 },
    });
    assert.match(saved.error?.message ?? "", /5,000,000/);
    assert.equal((await ownedQueryFile(extra, a.id)).char_count, 0);
  } finally {
    if (paths.length) await db.storage.from("query-files").remove(paths);
    if (sessions.length)
      await db.from("demo_sessions").delete().in("id", sessions);
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
}, 120000);
