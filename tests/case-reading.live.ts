import { test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  caseFields,
  type ReadingProgress,
} from "../src/features/cases/case-reading";
import { hashSessionToken } from "../src/features/cases/session-token";

test("live AI reads a large source and companion documents, then saves reviewed fields with original evidence", async () => {
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  for (const value of [base, process.env.SUPABASE_URL ?? ""])
    assert.ok(
      ["localhost", "127.0.0.1"].includes(new URL(value).hostname),
      "Live fixtures must use local services.",
    );
  const db = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SECRET_KEY ?? "",
    { auth: { persistSession: false } },
  );
  const started = await fetch(`${base}/api/demo-session`, { method: "POST" });
  const cookie = started.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  const owner = await db
    .from("demo_sessions")
    .select("id")
    .eq("token_hash", hashSessionToken(cookie.split("=")[1]))
    .single();
  assert.ok(owner.data);
  const sessionId = owner.data.id,
    id = randomUUID();
  const headers = { Cookie: cookie, "Content-Type": "application/json" };
  async function api(path: string, body?: unknown) {
    const result = await fetch(`${base}${path}`, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.equal(result.ok, true, await result.clone().text());
    return result.json();
  }
  try {
    const initial = (
      await api("/api/cases", {
        requestKey: id,
        title: "AI reading in progress",
      })
    ).case;
    const documents = [
      [
        "Cedar SRS.md",
        `# Fictional Cedar invoice review project\nSRS: the project proposes manual invoice review and automated email notifications. Intended benefits are goals and have not been measured.\n${"Cedar requirement notes: finance staff need to review invoices and record approval history.\n".repeat(700)}\nEnd of SRS: delivery outcomes are not established by these requirements.`,
      ],
      [
        "Cedar meeting minutes.txt",
        "Fictional Cedar meeting minutes: finance review is the release priority. Automated email notifications were postponed to a later release. This decision supersedes the initial planned notification scope.",
      ],
      [
        "Cedar retrospective.md",
        "Fictional Cedar retrospective: the team delivered manual invoice approval with approval history. Automated email notifications were postponed and did not ship. Lesson: confirm the release scope before committing to notification automation. No measured time-saving outcome was recorded.",
      ],
    ];
    assert.ok(documents[0][1].length > 50000);
    for (const [title, text] of documents) {
      const source = await api(`/api/cases/${id}/sources`, {
        requestKey: randomUUID(),
        title,
        text,
      });
      for (let attempt = 0; attempt < 10; attempt++) {
        await api(`/api/sources/${source.sourceId}/process`, {});
        const detail = (await api(`/api/cases/${id}`)).case;
        if (
          detail.sources.find(
            (s: { id: string; status: string }) => s.id === source.sourceId,
          )?.status === "ready"
        )
          break;
      }
    }
    let progress: ReadingProgress | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      progress = await api(`/api/cases/${id}/read`, {
        readingId: progress?.id,
      });
      if (progress?.status === "ready") break;
    }
    assert.ok(progress);
    assert.equal(progress.status, "ready");
    const reading = progress?.result;
    assert.ok(reading);
    assert.equal(reading.sourceIds?.length, 3);
    assert.ok(reading.suggestions.title.value);
    assert.ok(progress.total > 3);
    for (const field of [
      reading.suggestions.title,
      reading.suggestions.context,
      reading.suggestions.outcome,
      reading.suggestions.lessons,
    ])
      for (const evidence of field.evidence) {
        assert.ok(evidence.sourceId);
        const source = await db
          .from("source_documents")
          .select("pages")
          .eq("id", evidence.sourceId)
          .single();
        assert.ok(
          source.data?.pages.some((page: { text: string }) =>
            page.text
              .replace(/\s+/g, " ")
              .includes(evidence.quote.replace(/\s+/g, " ")),
          ),
        );
      }
    const outcome = reading.suggestions.outcome.value.toLowerCase();
    assert.ok(!/measured.*(faster|savings)|10x/.test(outcome));
    const fields = Object.fromEntries(
      Object.entries({
        title: reading.suggestions.title,
        context: reading.suggestions.context,
        outcome: reading.suggestions.outcome,
        lessons: reading.suggestions.lessons,
      }).map(([name, value]) => [name, value.value]),
    );
    fields.title = "Reviewed Cedar invoice case";
    const saved = (
      await api(`/api/cases/${id}/review`, {
        readingId: reading.id,
        fields,
        expected: caseFields(initial),
      })
    ).case;
    assert.equal(saved.title, fields.title);
    assert.equal(saved.aiReview.id, reading.id);
    assert.notEqual(saved.title, saved.aiReview.suggestions.title.value);
    const again = await api(`/api/cases/${id}/read`, { readingId: reading.id });
    assert.equal(again.id, reading.id);
    const attempts = await db
      .from("case_ai_attempts")
      .select("id", { count: "exact", head: true })
      .eq("reading_id", reading.id);
    assert.equal(attempts.count, 1);
    console.log(
      `Verified ${progress.completed}/${progress.total} sections across three fictional documents, including a >50,000-character source; exact evidence, reviewed save, and cached reuse passed.`,
    );
  } finally {
    await db.from("demo_sessions").delete().eq("id", sessionId);
  }
}, 240000);
