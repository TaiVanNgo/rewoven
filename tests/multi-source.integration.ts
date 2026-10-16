import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";

mock.module("server-only", () => ({}));
const { processSource, reconcileUploads } =
  await import("../src/features/cases/server/sources");
const { retrieve } = await import("../src/features/retrieval/server/retrieve");
const { embedTexts } = await import("../src/features/cases/server/embeddings");
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);
const vector = (axis = 0) =>
  Array.from({ length: 1536 }, (_, i) => (i === axis ? 1 : 0));

test("multiple originals, 5 MB transport, resume, isolation, partial failure and grounded hybrid retrieval", async () => {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const sessions: string[] = [];
  const paths: string[] = [];
  async function session() {
    const token = newSessionToken();
    const record = await db
      .from("demo_sessions")
      .insert({ token_hash: hashSessionToken(token) })
      .select("id")
      .single();
    assert.ok(record.data);
    sessions.push(record.data.id);
    return { id: record.data.id, cookie: `rewoven-session=${token}` };
  }
  async function api(cookie: string, path: string, body?: unknown) {
    return fetch(`${base}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  try {
    const a = await session(),
      b = await session();
    const id = randomUUID();
    const created = await api(a.cookie, "/api/cases", {
      requestKey: id,
      title: "Multi-source integration",
    });
    assert.equal(created.status, 201, await created.clone().text());
    const sources: string[] = [];
    for (const [title, text] of [
      ["SRS.txt", "The plan requires manager approval."],
      ["minutes.md", "The team postponed approval automation."],
      [
        "retro.txt",
        "Shipped manual approval. Penguins reconciliation reduces duplicate imports.",
      ],
    ]) {
      const key = randomUUID();
      const body = { requestKey: key, title, text };
      const responses = await Promise.all([
        api(a.cookie, `/api/cases/${id}/sources`, body),
        api(a.cookie, `/api/cases/${id}/sources`, body),
      ]);
      for (const r of responses)
        assert.equal(r.status, 201, await r.clone().text());
      sources.push(key);
      await processSource(key, a.id);
    }
    const before = (
      await db.from("source_chunks").select("id").eq("source_id", sources[0])
    ).data?.map((c) => c.id);
    await processSource(sources[0], a.id, false, async () => {
      throw new Error("Temporary embedding outage");
    });
    const failed = (
      await db
        .from("source_documents")
        .select("status,indexing_status")
        .eq("id", sources[0])
        .single()
    ).data;
    assert.equal(failed?.status, "ready");
    assert.equal(failed?.indexing_status, "failed");
    await processSource(sources[0], a.id, true, async (texts) =>
      texts.map(() => vector()),
    );
    assert.deepEqual(
      (
        await db.from("source_chunks").select("id").eq("source_id", sources[0])
      ).data?.map((c) => c.id),
      before,
    );
    for (const source of sources.slice(1))
      await processSource(source, a.id, false, async (texts) =>
        texts.map(() => vector()),
      );
    const query = await retrieve(
      { request: "approval", technology: "manual workflow" },
      a.id,
      async (texts) => texts.map(() => vector()),
    );
    assert.equal(query.mode, "hybrid");
    assert.equal(query.cases[0].id, id);
    assert.ok(query.cases[0].passages.length <= 3);
    for (const passage of query.cases[0].passages) {
      const text = await (
        await api(
          a.cookie,
          `/api/sources/${passage.source_id}/text?page=${passage.page_number ?? 1}&start=${passage.char_start}`,
        )
      ).json();
      assert.equal(
        text.text.slice(0, passage.char_end - passage.char_start),
        passage.text,
      );
    }
    assert.equal(
      (
        await retrieve({ request: "approval" }, b.id, async (texts) =>
          texts.map(() => vector()),
        )
      ).cases.some((c) => c.id === id),
      false,
    );
    assert.equal(
      (
        await retrieve(
          { request: "zzxxyy lunar trajectory" },
          a.id,
          async (texts) => texts.map(() => vector(100)),
        )
      ).cases.length,
      0,
    );
    const fallback = await retrieve({ request: "Penguins" }, a.id, async () => {
      throw new Error("Provider offline");
    });
    assert.equal(fallback.mode, "keyword");
    assert.ok(fallback.cases.some((c) => c.id === id));
    for (const suffix of ["text", "original"])
      assert.equal(
        (await api(b.cookie, `/api/sources/${sources[0]}/${suffix}`)).status,
        404,
      );
    for (const suffix of ["complete", "process"])
      assert.equal(
        (await api(b.cookie, `/api/sources/${sources[0]}/${suffix}`, {}))
          .status,
        404,
      );
    assert.equal(
      (
        await api(b.cookie, `/api/cases/${id}/sources`, {
          requestKey: randomUUID(),
          title: "stolen",
          text: "x",
        })
      ).status,
      404,
    );
    const bad = randomUUID();
    await api(a.cookie, `/api/cases/${id}/sources`, {
      requestKey: bad,
      title: "bad.txt",
      text: "valid original",
    });
    await db
      .from("source_documents")
      .update({ original_text: " " })
      .eq("id", bad);
    await processSource(bad, a.id);
    assert.equal(
      (await db.from("cases").select("status").eq("id", id).single()).data
        ?.status,
      "ready",
    );
    // A retained upload can be completed after reloading without reuploading it.
    const fileId = randomUUID();
    const file = new Uint8Array(5_000_000);
    file.set(new Uint8Array(await readFile("tests/fixtures/mixed-pages.pdf")));
    const reserve = await api(a.cookie, `/api/cases/${id}/sources`, {
      requestKey: fileId,
      title: "full.pdf",
      size: file.length,
    });
    assert.equal(reserve.status, 201, await reserve.clone().text());
    const upload = await reserve.json();
    assert.ok(upload.uploadUrl);
    const path = (
      await db
        .from("source_documents")
        .select("storage_path")
        .eq("id", fileId)
        .single()
    ).data?.storage_path;
    paths.push(path);
    const put = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });
    assert.equal(put.ok, true, await put.clone().text());
    assert.equal(
      (await api(a.cookie, `/api/sources/${fileId}/complete`, {})).status,
      200,
    );
    assert.equal(
      (await api(a.cookie, `/api/sources/${fileId}/complete`, {})).status,
      200,
    );
    const original = await api(a.cookie, `/api/sources/${fileId}/original`);
    assert.equal(original.status, 200);
    assert.equal((await original.arrayBuffer()).byteLength, 5_000_000);
    assert.equal(
      (
        await api(a.cookie, `/api/cases/${id}/sources`, {
          requestKey: randomUUID(),
          title: "big.txt",
          size: 5_000_001,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api(a.cookie, `/api/cases/${id}/sources`, {
          requestKey: randomUUID(),
          title: "big text",
          text: "x".repeat(500_001),
        })
      ).status,
      400,
    );
    const longId = randomUUID(),
      tail = "endmarkerpenguin";
    await api(a.cookie, `/api/cases/${id}/sources`, {
      requestKey: longId,
      title: "long text",
      text: "a ".repeat(30000) + tail,
    });
    await processSource(longId, a.id);
    const matches = await retrieve({ request: tail }, a.id, async () => {
      throw new Error("Offline");
    });
    assert.ok(
      matches.cases.some((c) => c.passages.some((p) => p.text.includes(tail))),
    );
    const detail = (await (await api(a.cookie, `/api/cases/${id}`)).json())
      .case;
    assert.ok(detail.sources.length >= 6);
    assert.ok(
      detail.sources.every(
        (s: { pages: unknown[]; extracted_text: null }) =>
          s.pages.length === 0 && s.extracted_text === null,
      ),
    );
  } finally {
    if (paths.length) await db.storage.from("case-sources").remove(paths);
    for (const id of sessions)
      await db.from("demo_sessions").delete().eq("id", id);
  }
}, 60000);

test("quota reservations serialize concurrent document, original-byte and extracted-text limits", async () => {
  const session = await db
    .from("demo_sessions")
    .insert({ token_hash: hashSessionToken(randomUUID()) })
    .select("id")
    .single();
  assert.ok(session.data);
  const owner = session.data.id;
  async function caseId() {
    const id = randomUUID();
    assert.equal(
      (
        await db.from("cases").insert({
          id,
          session_id: owner,
          request_key: id,
          title: "Quota fixture",
        })
      ).error,
      null,
    );
    return id;
  }
  function reserve(id: string, size = 1, text: string | null = "x") {
    return db.rpc("reserve_source", {
      p_case: id,
      p_session: owner,
      p_id: randomUUID(),
      p_title: "test.txt",
      p_format: text === null ? "txt" : "text",
      p_bytes: size,
      p_text: text,
    });
  }
  try {
    const count = await caseId();
    const outcomes = await Promise.all(
      Array.from({ length: 51 }, () => reserve(count)),
    );
    assert.equal(outcomes.filter((r) => !r.error).length, 50);
    assert.match(
      outcomes.find((r) => r.error)?.error?.message ?? "",
      /50 documents/,
    );
    const bytes = await caseId();
    const sizes = await Promise.all(
      Array.from({ length: 21 }, () => reserve(bytes, 5_000_000, null)),
    );
    assert.equal(sizes.filter((r) => !r.error).length, 20);
    assert.match(sizes.find((r) => r.error)?.error?.message ?? "", /100 MB/);
    const chars = await caseId();
    const originals = [];
    for (let i = 0; i < 11; i++) {
      const result = await reserve(chars, 500000, "a".repeat(500000));
      assert.equal(result.error, null);
      originals.push(result.data.id);
    }
    for (const id of originals.slice(0, 9)) await processSource(id, owner);
    await Promise.all(originals.slice(9).map((id) => processSource(id, owner)));
    const sources = await db
      .from("source_documents")
      .select("char_count,status,error_message")
      .eq("case_id", chars);
    assert.equal(
      sources.data?.reduce((n, s) => n + s.char_count, 0),
      5_000_000,
    );
    assert.equal(sources.data?.filter((s) => s.status === "ready").length, 10);
    assert.ok(
      sources.data?.some((s) => /5,000,000/.test(s.error_message ?? "")),
    );
    const expiredCase = await caseId();
    const abandoned = await reserve(expiredCase, 1, null);
    assert.equal(abandoned.error, null);
    await db
      .from("source_documents")
      .update({ upload_expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", abandoned.data.id);
    await reconcileUploads(expiredCase, owner);
    assert.equal(
      (
        await db
          .from("source_documents")
          .select("id")
          .eq("case_id", expiredCase)
      ).data?.length,
      0,
    );
    const budget = await db.rpc("reserve_embedding_budget", {
      p_session: owner,
      p_tokens: 100,
      p_session_limit: 0,
      p_daily_limit: 100000000,
    });
    assert.match(budget.error?.message ?? "", /budget reached/);
  } finally {
    await db.from("demo_sessions").delete().eq("id", owner);
  }
}, 60000);

test("embedding calls validate provider vectors and settle budgets without live AI requests", async () => {
  const session = await db
    .from("demo_sessions")
    .insert({ token_hash: hashSessionToken(randomUUID()) })
    .select("id")
    .single();
  assert.ok(session.data);
  const original = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "integration-mocked-key";
  try {
    const result = await embedTexts(
      ["hello"],
      session.data.id,
      async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.model, "text-embedding-3-small");
        return Response.json({
          data: [{ index: 0, embedding: vector() }],
          usage: { total_tokens: 1 },
        });
      },
    );
    assert.equal(result[0].length, 1536);
    assert.equal(
      (
        await db
          .from("embedding_usage")
          .select("tokens")
          .eq("session_id", session.data.id)
          .single()
      ).data?.tokens,
      1,
    );
    await assert.rejects(
      embedTexts(["bad"], session.data.id, async () =>
        Response.json({ data: [{ index: 0, embedding: [1] }] }),
      ),
      /invalid embeddings/,
    );
    await assert.rejects(
      embedTexts(
        ["failure"],
        session.data.id,
        async () => new Response(null, { status: 429 }),
      ),
      /could not create embeddings/,
    );
  } finally {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
    await db.from("demo_sessions").delete().eq("id", session.data.id);
  }
});
