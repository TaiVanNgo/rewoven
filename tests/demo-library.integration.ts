import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadSampleCatalog } from "../scripts/sample-catalog";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";
import { clarificationPlan } from "../src/features/plans/content";
import type { Evidence } from "../src/features/queries/types";
import type {
  RequestDocumentContext,
  RequestEvidence,
  RequestFinding,
} from "../src/features/query-files/types";

mock.module("server-only", () => ({}));
const { createQuery, updateChatContext, queryDetail } =
  await import("../src/features/queries/server/repository");
const { processAssistantTurn } =
  await import("../src/features/queries/server/process-assistant");
const { retrieveAssistant } =
  await import("../src/features/queries/server/assistant-retrieval");
const { createPlan } = await import("../src/features/plans/server/repository");
const { processPlan } = await import("../src/features/plans/server/process");
const { queryFileUpload, completeQueryFile, processQueryFile, ownedQueryFile } =
  await import("../src/features/query-files/server/repository");
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("default library discovers nine projects, excludes other sessions and retired records, and survives plan generation", async () => {
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
  const outsider = await db
    .from("demo_sessions")
    .insert({ token_hash: hashSessionToken(newSessionToken()) })
    .select("id")
    .single();
  assert.ifError(outsider.error);
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "mock-demo-library";
  const retiredId = randomUUID();
  const privateId = randomUUID();
  const keyword = async (): Promise<number[][]> => {
    throw new Error("mock keyword fallback");
  };
  const paths: string[] = [];
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
            session_id: sample ? null : outsider.data.id,
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
    const inputs = await Promise.all(
      ["client-brief.pdf", "constraints.md"].map(async (title) => ({
        id: randomUUID(),
        title,
        bytes: await readFile(
          new URL(
            `../output/pdf/rewoven-purchase-demo/upload/Client input/${title}`,
            import.meta.url,
          ),
        ),
      })),
    );
    let query = await createQuery(
      {
        requestKey: randomUUID(),
        request: "Review request history",
        assistant: true,
        files: inputs.map(({ id, title, bytes }) => ({
          id,
          title,
          size: bytes.length,
        })),
      },
      sessionId,
    );
    for (const input of inputs) {
      const file = await ownedQueryFile(input.id, sessionId);
      paths.push(file.storage_path);
      const { uploadUrl } = await queryFileUpload(input.id, sessionId);
      assert.ok(uploadUrl);
      const uploaded = await fetch(uploadUrl, {
        method: "PUT",
        body: input.bytes,
      });
      assert.equal(uploaded.ok, true);
      await completeQueryFile(input.id, sessionId);
      for (let step = 0; step < 20; step++) {
        if ((await ownedQueryFile(input.id, sessionId)).status === "ready")
          break;
        await processQueryFile(input.id, sessionId, true, {
          model: async (_kind, value) => {
            const data = value as {
              excerpts?: RequestEvidence[];
              findings?: RequestFinding[];
            };
            if (data.findings) return { findings: data.findings.slice(0, 12) };
            const passage = data.excerpts?.[0];
            assert.ok(passage);
            return {
              findings: [
                {
                  kind: "requirement",
                  text: passage.text.slice(0, 500),
                  evidence: [passage.id],
                },
              ],
            };
          },
        });
      }
      assert.equal((await ownedQueryFile(input.id, sessionId)).status, "ready");
    }
    query = await queryDetail(query.id, sessionId);
    const turnId = randomUUID();
    query = await processAssistantTurn(
      query.id,
      {
        requestKey: turnId,
        message: "Review request history",
        contextRevision: query.context_revision,
      },
      sessionId,
      {
        embedder: keyword,
        model: async (kind, input) => {
          const payload = input as {
            catalog: { id: string }[];
            evidence?: Evidence[];
            requestDocuments: RequestDocumentContext;
          };
          assert.equal(payload.requestDocuments.documents.length, 2);
          assert.ok(payload.requestDocuments.evidence.length);
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
                kind: "inference",
                heading: "",
                text: "The new request can be compared with decisions in the fictional project history.",
                evidence: [
                  payload.evidence[0].id,
                  payload.requestDocuments.evidence[0].id,
                ],
              },
            ],
          };
        },
      },
    );
    assert.equal(
      query.turns[0].status,
      "ready",
      query.turns[0].error_message ?? "",
    );
    assert.equal(query.turns[0].context_snapshot?.mode, "library");
    assert.equal(query.turns[0].request_file_ids?.length, 2);
    assert.ok(query.turns[0].work?.requestEvidence?.length);
    assert.equal(
      new Set(query.turns[0].work?.evidence.map((e) => e.case_id)).size,
      9,
    );
    const restored = await fetch(`${base}/api/queries/${query.id}`, {
      headers: { Cookie: `rewoven-session=${token}` },
    });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).query.chat_context.mode, "library");
    const rejected = await retrieveAssistant(
      ["Threadline"],
      { mode: "library", caseIds: [] },
      [privateId, retiredId],
      sessionId,
      keyword,
    );
    assert.deepEqual(rejected.passages, []);
    const defaultLibrary = await retrieveAssistant(
      ["Threadline"],
      { mode: "library", caseIds: [] },
      [],
      sessionId,
      keyword,
    );
    assert.ok(defaultLibrary.passages.length);
    assert.ok(defaultLibrary.passages.every((p) => ids.has(p.case_id)));
    // The SQL boundary independently protects default discovery, including
    // callers other than retrieveAssistant.
    const direct = await db.rpc("retrieve_assistant_passages", {
      p_session: sessionId,
      p_query: "Threadline request review history",
    });
    assert.ifError(direct.error);
    assert.ok(direct.data.length);
    assert.ok(
      direct.data.every((p: { case_id: string }) => ids.has(p.case_id)),
    );

    const plan = await createPlan(
      query.id,
      { requestKey: randomUUID(), contextRevision: query.context_revision },
      sessionId,
    );
    assert.equal(plan.snapshot.context.mode, "library");
    assert.equal(plan.snapshot.requestDocuments?.documents.length, 2);
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
    assert.equal(ready.snapshot.context.mode, "library");
    assert.ok(ready.request_evidence?.length);
    // Session-owned uploads join the same library; no scope switch is needed.
    assert.ifError(
      (
        await db
          .from("cases")
          .update({ session_id: sessionId })
          .eq("id", privateId)
      ).error,
    );
    const combined = await retrieveAssistant(
      ["Threadline request review history"],
      { mode: "library", caseIds: [] },
      [],
      sessionId,
      keyword,
    );
    assert.ok(combined.passages.some((p) => p.case_id === privateId));
    assert.ok(combined.passages.some((p) => ids.has(p.case_id)));
    assert.ok(combined.passages.every((p) => p.case_id !== retiredId));
    const changed = await updateChatContext(
      query.id,
      {
        contextRevision: query.context_revision,
        chatContext: { mode: "library", caseIds: [] },
      },
      sessionId,
    );
    assert.equal(changed.chat_context?.mode, "library");
    assert.equal(changed.turns[0].context_snapshot?.mode, "library");
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    await db.from("cases").delete().eq("id", retiredId);
    await db.from("demo_sessions").delete().eq("id", sessionId);
    await db.from("demo_sessions").delete().eq("id", outsider.data.id);
    if (paths.length) await db.storage.from("query-files").remove(paths);
  }
}, 30000);
