import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { hashSessionToken } from "../src/features/cases/session-token";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);

test("explicit grants repair hosted-style permissions while keeping browser roles blocked", async () => {
  const migration = await readFile(
    "supabase/migrations/202610160001_case_library_service_role_grants.sql",
    "utf8",
  );
  const sql = (await readFile("tests/service-role-grants.sql", "utf8")).replace(
    /^\\ir .*$/m,
    migration,
  );
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_rewoven",
      "psql",
      "--username",
      "postgres",
      "--dbname",
      "postgres",
      "--set",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

test("concurrent duplicate reservations preserve one case and one source", async () => {
  const session = await db
    .from("demo_sessions")
    .insert({ token_hash: hashSessionToken(randomUUID()) })
    .select("id")
    .single();
  assert.equal(session.error, null);
  assert.ok(session.data);
  const sessionId = session.data.id;
  try {
    const pairs = await Promise.all(
      Array.from({ length: 40 }, async () => {
        const id = randomUUID();
        const args = {
          p_id: id,
          p_session: sessionId,
          p_input: {
            title: "Concurrent reservation",
            context: "",
            outcome: "",
            lessons: "",
          },
          p_source: {
            title: "Original text",
            format: "text",
            original_text: "Fictional reservation fixture.",
          },
        };
        return Promise.all([
          db.rpc("reserve_case", args),
          db.rpc("reserve_case", args),
        ]);
      }),
    );
    for (const pair of pairs) {
      for (const result of pair)
        assert.equal(result.error, null, result.error?.message);
      assert.deepEqual(pair.map((result) => result.data).sort(), [false, true]);
    }
    const cases = await db
      .from("cases")
      .select("id, source_documents(id)")
      .eq("session_id", sessionId);
    assert.equal(cases.error, null);
    assert.equal(cases.data?.length, 40);
    for (const record of cases.data ?? [])
      assert.equal(record.source_documents.length, 1);
  } finally {
    const removed = await db.from("demo_sessions").delete().eq("id", sessionId);
    assert.equal(removed.error, null);
  }
}, 60_000);

test("case library persists, isolates sessions, preserves evidence, and recovers ingestion", async () => {
  const sessions: string[] = [];
  async function session() {
    const response = await fetch(`${base}/api/demo-session`, {
      method: "POST",
    });
    assert.equal(response.status, 200, await response.clone().text());
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);
    const token = cookie.split("=")[1];
    const record = await db
      .from("demo_sessions")
      .select("id")
      .eq("token_hash", hashSessionToken(token))
      .single();
    assert.ok(record.data);
    sessions.push(record.data.id);
    return cookie;
  }
  async function api(cookie: string, path: string, init: RequestInit = {}) {
    return fetch(`${base}${path}`, {
      ...init,
      headers: { ...init.headers, Cookie: cookie },
    });
  }
  async function create(
    cookie: string,
    options: {
      key?: string;
      text?: string;
      file?: string;
      title?: string;
    } = {},
  ) {
    const form = new FormData();
    form.set("requestKey", options.key ?? randomUUID());
    form.set("title", options.title ?? "Integration test case");
    form.set("mode", options.file ? "file" : "text");
    if (options.file)
      form.set(
        "file",
        new Blob([await readFile(options.file)]),
        options.file.split("/").pop(),
      );
    else
      form.set(
        "text",
        options.text ??
          "Permission approval audit evidence for integration checks.",
      );
    return api(cookie, "/api/cases", { method: "POST", body: form });
  }
  try {
    const a = await session();
    const b = await session();
    assert.equal((await fetch(`${base}/api/cases`)).status, 401);
    assert.equal(
      (
        await api(a, "/api/demo-session", {
          method: "POST",
          headers: { Origin: "https://foreign.example" },
        })
      ).status,
      403,
    );
    const seeds = (await (await api(a, "/api/cases")).json()).cases;
    assert.equal(
      seeds.filter((c: { is_seed: boolean }) => c.is_seed).length,
      10,
    );
    const seed = seeds.find(
      (c: { title: string }) => c.title === "Expense Approval Portal",
    );
    assert.ok(seed);
    assert.equal(
      (await api(a, `/api/cases/${seed.id}/retry`, { method: "POST" })).status,
      403,
    );
    const seedDetail = (await (await api(a, `/api/cases/${seed.id}`)).json())
      .case;
    assert.ok(seedDetail.sources.length === 2);
    const pdf = seedDetail.sources.find(
      (s: { format: string }) => s.format === "pdf",
    );
    assert.match(pdf.pages[2].text, /single manager/);
    const original = await api(a, `/api/sources/${pdf.id}/original`);
    assert.equal(original.status, 200);
    assert.match(await original.text(), /%PDF/);
    const key = randomUUID();
    // The keyword straddles the old fixed 2,000-character chunk boundary.
    const text = `${"a ".repeat(998)}narwhal approval procedure.\n`;
    const [first, duplicate] = await Promise.all([
      create(a, { key, text }),
      create(a, { key, text }),
    ]);
    assert.equal(first.status, 201, await first.clone().text());
    assert.equal(duplicate.status, 201, await duplicate.clone().text());
    const created = (await first.json()).case;
    assert.equal(created.id, key);
    const detail = (await (await api(a, `/api/cases/${key}`)).json()).case;
    assert.equal(detail.status, "ready");
    assert.equal(detail.sources.length, 1);
    assert.equal(detail.sources[0].extracted_text, text);
    assert.equal(detail.session_id, undefined);
    assert.equal(detail.processing_token, undefined);
    assert.equal(
      await (
        await api(a, `/api/sources/${detail.sources[0].id}/original`)
      ).text(),
      text,
    );
    assert.equal((await api(b, `/api/cases/${key}`)).status, 404);
    assert.equal(
      (await api(b, `/api/cases/${key}/retry`, { method: "POST" })).status,
      404,
    );
    assert.equal(
      (await api(b, `/api/sources/${detail.sources[0].id}/original`)).status,
      404,
    );
    const aMatches = (await (await api(a, "/api/cases?q=narwhal")).json())
      .cases;
    const bMatches = (await (await api(b, "/api/cases?q=narwhal")).json())
      .cases;
    assert.ok(aMatches.some((c: { id: string }) => c.id === key));
    assert.equal(bMatches.length, 0);
    assert.equal((await create(a, { text: " " })).status, 400);
    assert.equal((await create(a, { text: "x".repeat(50_001) })).status, 400);
    for (const file of [
      "supabase/fixtures/retrospective.md",
      "supabase/fixtures/purchase-workflow.txt",
    ]) {
      const response = await create(a, { file });
      assert.equal(response.status, 201);
      const record = (await response.json()).case;
      assert.equal(record.status, "ready");
      const original = await api(
        a,
        `/api/sources/${record.sources[0].id}/original`,
      );
      assert.equal(await original.text(), await readFile(file, "utf8"));
    }
    for (const [filename, content] of [
      ["bad.docx", new Uint8Array([1])],
      ["big.txt", new Uint8Array(5_000_001)],
    ] as const) {
      const form = new FormData();
      form.set("requestKey", randomUUID());
      form.set("title", "Invalid upload");
      form.set("mode", "file");
      form.set("file", new Blob([content]), filename);
      const response = await api(a, "/api/cases", {
        method: "POST",
        body: form,
      });
      assert.equal(response.status, 400);
    }
    for (const file of [
      "tests/fixtures/encrypted.pdf",
      "tests/fixtures/too-much-text.pdf",
    ]) {
      const record = (await (await create(a, { file })).json()).case;
      assert.equal(record.status, "failed");
      assert.ok(record.error_message);
      assert.equal(record.sources[0].extracted_text, null);
    }
    await db.from("cases").update({ status: "failed" }).eq("id", key);
    assert.equal(
      (await (await api(a, "/api/cases?q=narwhal")).json()).cases.length,
      0,
    );
    const activeToken = randomUUID();
    await db
      .from("cases")
      .update({
        status: "processing",
        processing_token: activeToken,
        processing_started_at: new Date().toISOString(),
      })
      .eq("id", key);
    const busy = (
      await (await api(a, `/api/cases/${key}/retry`, { method: "POST" })).json()
    ).case;
    assert.equal(busy.status, "processing");
    assert.equal(
      (await db.from("cases").select("processing_token").eq("id", key).single())
        .data?.processing_token,
      activeToken,
    );
    const mixed = (
      await (await create(a, { file: "tests/fixtures/mixed-pages.pdf" })).json()
    ).case;
    assert.equal(mixed.status, "ready");
    assert.equal(mixed.sources[0].pages[2].number, 3);
    assert.equal(mixed.sources[0].warnings.length, 1);
    const failed = (
      await (await create(a, { file: "tests/fixtures/no-text.pdf" })).json()
    ).case;
    assert.equal(failed.status, "failed");
    assert.match(failed.error_message, /Scanned PDFs/);
    assert.equal(
      (await api(a, `/api/sources/${failed.sources[0].id}/original`)).status,
      200,
    );
    const retried = (
      await (
        await api(a, `/api/cases/${failed.id}/retry`, { method: "POST" })
      ).json()
    ).case;
    assert.equal(retried.id, failed.id);
    assert.equal(retried.status, "failed");
    await db
      .from("cases")
      .update({
        status: "processing",
        processing_token: randomUUID(),
        processing_started_at: new Date(Date.now() - 130_000).toISOString(),
      })
      .eq("id", key);
    const recovered = (
      await (await api(a, `/api/cases/${key}/retry`, { method: "POST" })).json()
    ).case;
    assert.equal(recovered.status, "ready");
    assert.equal(recovered.sources.length, 1);
    // The database boundary also rejects requests made with the local anonymous key.
    const config = JSON.parse(
      spawnSync("supabase", ["status", "--output", "json"], {
        encoding: "utf8",
      }).stdout,
    );
    const anon = createClient(process.env.SUPABASE_URL ?? "", config.ANON_KEY, {
      auth: { persistSession: false },
    });
    const denied = await anon.from("cases").select("id");
    assert.ok(denied.error);
    const deniedRpc = await anon.rpc("search_cases", {
      p_session_id: sessions[0],
      p_query: "",
    });
    assert.ok(deniedRpc.error);
    const deniedFile = await anon.storage
      .from("case-sources")
      .download(`seeds/${seed.id}/${pdf.id}/delivery-notes.pdf`);
    assert.ok(deniedFile.error);
    await db
      .from("demo_sessions")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", sessions[0]);
    assert.equal((await api(a, `/api/cases/${key}`)).status, 401);
    assert.equal(
      (await api(a, `/api/sources/${detail.sources[0].id}/original`)).status,
      401,
    );
    const renewed = await api(a, "/api/demo-session", { method: "POST" });
    assert.equal(renewed.status, 200);
    const renewedCookie = renewed.headers.get("set-cookie")?.split(";")[0];
    assert.ok(renewedCookie);
    assert.notEqual(renewedCookie, a);
    const renewedRecord = await db
      .from("demo_sessions")
      .select("id")
      .eq("token_hash", hashSessionToken(renewedCookie.split("=")[1]))
      .single();
    if (renewedRecord.data) sessions.push(renewedRecord.data.id);
    assert.equal((await api(renewedCookie, `/api/cases/${key}`)).status, 404);
  } finally {
    const cases = await db
      .from("cases")
      .select("id")
      .in("session_id", sessions);
    if (cases.data?.length) {
      const sources = await db
        .from("source_documents")
        .select("storage_path")
        .in(
          "case_id",
          cases.data.map((c) => c.id),
        );
      const paths = (sources.data ?? []).flatMap((s) =>
        s.storage_path ? [s.storage_path] : [],
      );
      if (paths.length) await db.storage.from("case-sources").remove(paths);
    }
    if (sessions.length)
      await db.from("demo_sessions").delete().in("id", sessions);
  }
}, 120_000);
