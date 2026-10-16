import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { hashSessionToken } from "../src/features/cases/session-token";

// Explicitly opt in with test:ai:live: this makes one billable reading of a fictional PDF.
test("live fictional PDF reading survives review, save, reload, and source inspection", async () => {
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  for (const url of [base, process.env.SUPABASE_URL ?? ""]) {
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname),
      "Live fixture verification is local-only.",
    );
  }
  const db = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SECRET_KEY ?? "",
    { auth: { persistSession: false } },
  );
  const response = await fetch(`${base}/api/demo-session`, { method: "POST" });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  const session = await db
    .from("demo_sessions")
    .select("id")
    .eq("token_hash", hashSessionToken(cookie.split("=")[1]))
    .single();
  assert.ok(session.data);
  const sessionId = session.data.id;
  const headers = { Cookie: cookie };
  let paths: string[] = [];
  try {
    const original = await readFile(
      "output/pdf/rewoven-test-pack/pdf/01-harbor-route-planning.pdf",
    );
    const form = new FormData();
    form.set("mode", "file");
    form.set("file", new File([original], "01-harbor-route-planning.pdf"));
    const read = await fetch(`${base}/api/cases/analyze`, {
      method: "POST",
      headers,
      body: form,
    });
    assert.equal(read.status, 200, await read.clone().text());
    const analysis = await read.json();
    assert.ok(analysis.suggestions.title.value);
    assert.equal(analysis.isPdf, true);
    assert.equal(analysis.pageCount, 12);
    assert.ok(analysis.suggestions.outcome.value);
    assert.ok(analysis.suggestions.context.evidence.length);
    const cached = await fetch(`${base}/api/cases/analyze`, {
      method: "POST",
      headers,
      body: form,
    });
    assert.equal((await cached.json()).id, analysis.id);
    const usage = await db
      .from("case_ai_attempts")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    assert.equal(usage.count, 1);
    const id = crypto.randomUUID();
    form.set("requestKey", id);
    form.set("analysisId", analysis.id);
    form.set("title", "Reviewed fictional route planning pilot");
    form.set("context", analysis.suggestions.context.value);
    form.set("outcome", analysis.suggestions.outcome.value);
    form.set("lessons", analysis.suggestions.lessons.value);
    const added = await fetch(`${base}/api/cases`, {
      method: "POST",
      headers,
      body: form,
    });
    assert.equal(added.status, 201, await added.clone().text());
    paths = [`${sessionId}/${id}/source-v1.pdf`];
    const detail = await (
      await fetch(`${base}/api/cases/${id}`, { headers })
    ).json();
    assert.equal(detail.case.status, "ready");
    assert.equal(detail.case.title, "Reviewed fictional route planning pilot");
    assert.equal(
      detail.case.aiReview.suggestions.title.value,
      analysis.suggestions.title.value,
    );
    assert.notEqual(
      detail.case.title,
      detail.case.aiReview.suggestions.title.value,
    );
    const downloaded = await fetch(
      `${base}/api/sources/${detail.case.sources[0].id}/original`,
      { headers },
    );
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), original);
    console.log(
      "Live verification: one OpenAI reading; cached retry; reviewed fields, PDF pages, and immutable evidence preserved.",
    );
  } finally {
    if (paths.length) await db.storage.from("case-sources").remove(paths);
    await db.from("cases").delete().eq("session_id", sessionId);
    await db.from("demo_sessions").delete().eq("id", sessionId);
  }
}, 90_000);
