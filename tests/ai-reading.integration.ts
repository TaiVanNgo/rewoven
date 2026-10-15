import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";

mock.module("server-only", () => ({}));
const { analyzeSource } =
  await import("../src/features/cases/server/analyze-source");
const { createCase } = await import("../src/features/cases/server/ingestion");
const { caseAIConfig, CASE_PROMPT_VERSION, suggestCase } =
  await import("../src/features/cases/server/openai");
const { sourceInput } =
  await import("../src/features/cases/server/source-input");
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);

test("AI reading validates sources, persists review evidence, isolates sessions, caches, and enforces budgets without OpenAI calls", async () => {
  const sessions: string[] = [];
  let providerCalls = 0;
  const fakeReader: Parameters<typeof analyzeSource>[2] = async (
    pages,
    isPdf,
  ) => {
    providerCalls++;
    return suggestCase(
      pages,
      isPdf,
      { key: "test-key", model: "test-model" },
      async (_url, init) => {
        const excerpts = JSON.parse(
          JSON.parse(String(init.body)).input[0].content,
        ).source_excerpts;
        const output = {
          title: {
            value: "AI fixture title",
            evidence: [excerpts[0].id],
          },
          context: { value: "", evidence: [] },
          outcome: { value: "", evidence: [] },
          lessons: { value: "", evidence: [] },
        };
        return Response.json({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(output) }],
            },
          ],
        });
      },
    );
  };
  async function session() {
    const token = newSessionToken();
    const record = await db
      .from("demo_sessions")
      .insert({ token_hash: hashSessionToken(token) })
      .select("id")
      .single();
    assert.equal(record.error, null);
    assert.ok(record.data);
    sessions.push(record.data.id);
    return { id: record.data.id, cookie: `rewoven-session=${token}` };
  }
  function textForm(
    text = "Fictional Project Beacon tracks support requests. Outcomes are not recorded.",
  ) {
    const form = new FormData();
    form.set("mode", "text");
    form.set("text", text);
    return form;
  }
  async function reserve(
    session: string,
    hash: string,
    sessionLimit: number | null = 10,
    dailyLimit: number | null = 1000,
  ) {
    const token = randomUUID();
    const result = await db.rpc("reserve_case_ai_reading", {
      p_session: session,
      p_hash: hash,
      p_model: "test-model",
      p_version: 1,
      p_token: token,
      p_session_limit: sessionLimit,
      p_daily_limit: dailyLimit,
    });
    assert.equal(result.error, null);
    return { ...result.data, token };
  }
  try {
    const a = await session();
    const b = await session();
    const form = textForm();
    const reading = await analyzeSource(form, a.id, fakeReader);
    assert.equal(providerCalls, 1);
    assert.equal(reading.suggestions.outcome.value, "");
    assert.deepEqual(await analyzeSource(form, a.id, fakeReader), reading);
    assert.equal(providerCalls, 1);
    // The actual HTTP endpoint also reuses the trusted cache, never calling OpenAI.
    const cached = await fetch(`${base}/api/cases/analyze`, {
      method: "POST",
      headers: { Cookie: a.cookie },
      body: form,
    });
    assert.equal(cached.status, 200, await cached.clone().text());
    assert.equal((await cached.json()).id, reading.id);
    const immutable = await db
      .from("case_ai_readings")
      .update({ result: {} })
      .eq("id", reading.id);
    assert.ok(immutable.error);
    form.set("requestKey", randomUUID());
    form.set("title", "My reviewed title");
    form.set("analysisId", reading.id);
    const record = await createCase(form, a.id);
    assert.equal(record.title, "My reviewed title");
    assert.equal(record.status, "ready");
    assert.equal(record.aiReview?.suggestions.title.value, "AI fixture title");
    const detail = await fetch(`${base}/api/cases/${record.id}`, {
      headers: { Cookie: a.cookie },
    });
    const persisted = (await detail.json()).case;
    assert.equal(persisted.aiReview.id, reading.id);
    assert.equal(persisted.title, "My reviewed title");
    assert.equal((await createCase(form, a.id)).id, record.id);
    assert.equal(
      (
        await fetch(`${base}/api/cases/${record.id}`, {
          headers: { Cookie: b.cookie },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(`${base}/api/sources/${record.sources[0].id}/original`, {
          headers: { Cookie: b.cookie },
        })
      ).status,
      404,
    );
    form.set("requestKey", randomUUID());
    await assert.rejects(
      createCase(form, b.id),
      /does not match this session and source/,
    );
    form.set("text", "A different original source");
    await assert.rejects(
      createCase(form, a.id),
      /does not match this session and source/,
    );
    // A second session never receives the first session's cached reading.
    assert.notEqual(
      (await analyzeSource(textForm(), b.id, fakeReader)).id,
      reading.id,
    );
    for (const [path, type] of [
      ["supabase/fixtures/retrospective.md", "md"],
      ["supabase/fixtures/purchase-workflow.txt", "txt"],
      ["tests/fixtures/mixed-pages.pdf", "pdf"],
    ]) {
      const upload = new FormData();
      upload.set("mode", "file");
      upload.set("file", new File([await readFile(path)], `source.${type}`));
      const result = await analyzeSource(upload, a.id, fakeReader);
      if (type === "pdf") {
        assert.equal(result.pageCount, 3);
        assert.match(result.warnings[0], /Page 2/);
        assert.equal(result.suggestions.title.evidence[0].page, 1);
      }
    }
    const callsBeforeInvalid = providerCalls;
    for (const path of ["no-text.pdf", "encrypted.pdf", "too-much-text.pdf"]) {
      const invalid = new FormData();
      invalid.set("mode", "file");
      invalid.set(
        "file",
        new File([await readFile(`tests/fixtures/${path}`)], path),
      );
      await assert.rejects(analyzeSource(invalid, a.id, fakeReader));
    }
    await assert.rejects(
      analyzeSource(textForm("x".repeat(50_001)), a.id, fakeReader),
      /50,000/,
    );
    assert.equal(providerCalls, callsBeforeInvalid);
    // Provider failure leaves a retryable record; retries consume attempts.
    const failForm = textForm("Failure fixture project");
    await assert.rejects(
      analyzeSource(failForm, a.id, async () => {
        throw new Error("simulated provider failure");
      }),
    );
    await analyzeSource(failForm, a.id, fakeReader);
    const failureSource = await sourceInput(failForm);
    const attempts = await db
      .from("case_ai_readings")
      .select("attempts,status")
      .eq("source_hash", failureSource.hash)
      .eq("session_id", a.id)
      .single();
    assert.equal(attempts.data?.attempts, 2);
    assert.equal(attempts.data?.status, "ready");

    const c = await session();
    const claims = await Promise.all([
      reserve(c.id, "one"),
      reserve(c.id, "one"),
    ]);
    assert.deepEqual(claims.map((c) => c.state).sort(), ["busy", "reserved"]);
    assert.equal((await reserve(c.id, "two")).state, "busy");
    const old = claims.find((c) => c.state === "reserved");
    await db
      .from("case_ai_readings")
      .update({ started_at: new Date(Date.now() - 130_000).toISOString() })
      .eq("id", old.id);
    const recovered = await reserve(c.id, "one");
    assert.equal(recovered.state, "reserved");
    const stale = await db
      .from("case_ai_readings")
      .update({ status: "failed" })
      .eq("id", old.id)
      .eq("processing_token", old.token)
      .select("id");
    assert.equal(stale.data?.length, 0);
    await db
      .from("case_ai_readings")
      .update({ status: "failed", processing_token: null })
      .eq("id", recovered.id);
    assert.equal((await reserve(c.id, "three", 2)).state, "session_limit");
    const usage = await db
      .from("case_ai_attempts")
      .select("id", { count: "exact", head: true })
      .gte("started_at", `${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const d = await session();
    const e = await session();
    const daily = await Promise.all([
      reserve(d.id, "global-one", 10, (usage.count ?? 0) + 1),
      reserve(e.id, "global-two", 10, (usage.count ?? 0) + 1),
    ]);
    assert.deepEqual(daily.map((c) => c.state).sort(), [
      "daily_limit",
      "reserved",
    ]);
    // A cached record is still available when new attempts are disabled.
    const source = await sourceInput(textForm());
    const config = caseAIConfig();
    const atLimit = await db.rpc("reserve_case_ai_reading", {
      p_session: a.id,
      p_hash: source.hash,
      p_model: config.model,
      p_version: CASE_PROMPT_VERSION,
      p_token: randomUUID(),
      p_session_limit: 0,
      p_daily_limit: 0,
    });
    assert.equal(atLimit.data.state, "cached");

    // The 50th production reservation succeeds; the 51st is blocked.
    const f = await session();
    const firstAttempt = await reserve(f.id, "limit-boundary-first", 50, null);
    assert.equal(firstAttempt.state, "reserved");
    assert.equal((await reserve(f.id, "still-busy", null, null)).state, "busy");
    const released = await db
      .from("case_ai_readings")
      .update({ status: "failed", processing_token: null })
      .eq("id", firstAttempt.id);
    assert.equal(released.error, null);
    const historicalAttempts = await db.from("case_ai_attempts").insert(
      Array.from({ length: 48 }, () => ({
        session_id: f.id,
        reading_id: firstAttempt.id,
      })),
    );
    assert.equal(historicalAttempts.error, null);
    const fiftieth = await reserve(f.id, "limit-boundary-50", 50, null);
    assert.equal(fiftieth.state, "reserved");
    const releaseFiftieth = await db
      .from("case_ai_readings")
      .update({ status: "failed", processing_token: null })
      .eq("id", fiftieth.id);
    assert.equal(releaseFiftieth.error, null);
    assert.equal(
      (await reserve(f.id, "limit-boundary-51", 50, null)).state,
      "session_limit",
    );
    assert.equal(
      (await reserve(f.id, "daily-still-limited", null, 0)).state,
      "daily_limit",
    );
    // Cross both production defaults without making any provider calls.
    const moreAttempts = await db.from("case_ai_attempts").insert(
      Array.from({ length: 51 }, () => ({
        session_id: f.id,
        reading_id: firstAttempt.id,
      })),
    );
    assert.equal(moreAttempts.error, null);
    const savedEnvironment = {
      NODE_ENV: process.env.NODE_ENV,
      AI_CASE_SESSION_LIMIT: process.env.AI_CASE_SESSION_LIMIT,
      AI_CASE_DAILY_LIMIT: process.env.AI_CASE_DAILY_LIMIT,
    };
    try {
      Object.assign(process.env, {
        NODE_ENV: "development",
        AI_CASE_SESSION_LIMIT: "0",
        AI_CASE_DAILY_LIMIT: "0",
      });
      assert.equal(caseAIConfig().sessionLimit, null);
      assert.equal(caseAIConfig().dailyLimit, null);
      const developmentReading = await analyzeSource(
        textForm("Development reading beyond 101 previous attempts."),
        f.id,
        fakeReader,
      );
      assert.ok(developmentReading.id);
      assert.equal(
        developmentReading.suggestions.title.value,
        "AI fixture title",
      );
    } finally {
      for (const [name, value] of Object.entries(savedEnvironment)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
    await db
      .from("demo_sessions")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", a.id);
    assert.equal(
      (
        await fetch(`${base}/api/cases/analyze`, {
          method: "POST",
          headers: { Cookie: a.cookie },
          body: textForm(),
        })
      ).status,
      401,
    );
    assert.equal((await reserve(a.id, "one")).state, "expired");
    assert.equal((await reserve(a.id, "one", null, null)).state, "expired");
    assert.equal(
      (await fetch(`${base}/api/cases/analyze`, { method: "POST" })).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/api/cases/analyze`, {
          method: "POST",
          headers: { Origin: "https://untrusted.example" },
        })
      ).status,
      403,
    );
    const local = JSON.parse(
      spawnSync("supabase", ["status", "--output", "json"], {
        encoding: "utf8",
      }).stdout,
    );
    const anon = createClient(process.env.SUPABASE_URL ?? "", local.ANON_KEY);
    for (const table of [
      "case_ai_readings",
      "case_ai_attempts",
      "case_ai_reviews",
    ])
      assert.ok((await anon.from(table).select("*")).error);
    assert.ok(
      (
        await anon.rpc("reserve_case_ai_reading", {
          p_session: b.id,
          p_hash: "x",
          p_model: "test-model",
          p_version: 1,
          p_token: randomUUID(),
          p_session_limit: 10,
          p_daily_limit: 100,
        })
      ).error,
    );
  } finally {
    const records = await db
      .from("source_documents")
      .select("storage_path,cases!inner(session_id)")
      .in("cases.session_id", sessions);
    const paths = (records.data ?? []).flatMap((r) =>
      r.storage_path ? [r.storage_path] : [],
    );
    if (paths.length) await db.storage.from("case-sources").remove(paths);
    // Reviews reference readings: delete owned cases before cascading the session.
    await db.from("cases").delete().in("session_id", sessions);
    const removed = await db.from("demo_sessions").delete().in("id", sessions);
    assert.equal(removed.error, null);
  }
}, 60_000);
