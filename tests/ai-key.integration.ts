import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { OPENAI_KEY_HEADER } from "../src/features/ai-key/validation";

mock.module("server-only", () => ({}));
const { withOpenAIKey } = await import("../src/features/ai-key/server");
const { database } = await import("../src/features/cases/server/db");
const { embedTexts } = await import("../src/features/cases/server/embeddings");

test("personal keys authorize embeddings with real local budget reservations and safe failures", async () => {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "http://missing").hostname,
    ),
    "This integration test requires local Supabase.",
  );
  const db = database();
  const inserted = await db
    .from("demo_sessions")
    .insert({ token_hash: randomBytes(32).toString("hex") })
    .select("id")
    .single();
  assert.equal(inserted.error, null);
  const session = inserted.data?.id;
  assert.ok(session);
  try {
    const key = `sk-proj-${"embedding-test".repeat(4)}`;
    let calls = 0;
    const handler = withOpenAIKey(async () => {
      const vectors = await embedTexts(
        ["A historical approval workflow."],
        session,
        async (url, init) => {
          calls++;
          assert.equal(url, "https://api.openai.com/v1/embeddings");
          assert.equal(
            new Headers(init?.headers).get("Authorization"),
            `Bearer ${key}`,
          );
          assert.doesNotMatch(String(init?.body), /sk-/);
          const vector = Array(1536).fill(0);
          vector[0] = 1;
          return Response.json({
            data: [{ index: 0, embedding: vector }],
            usage: { total_tokens: 5 },
          });
        },
      );
      assert.equal(vectors[0].length, 1536);
      await assert.rejects(
        embedTexts(
          ["A rejected embedding request."],
          session,
          async (_url, init) => {
            calls++;
            assert.equal(
              new Headers(init?.headers).get("Authorization"),
              `Bearer ${key}`,
            );
            return Response.json({ error: key }, { status: 401 });
          },
        ),
        /Replace your key/,
      );
      return Response.json({ ok: true });
    });
    const response = await handler(
      new Request("http://localhost/api/retrieval", {
        method: "POST",
        headers: { [OPENAI_KEY_HEADER]: key },
      }),
    );
    assert.equal(response.status, 200, await response.text());
    assert.equal(calls, 2);
    const usage = await db
      .from("embedding_usage")
      .select("tokens")
      .eq("session_id", session);
    assert.equal(usage.error, null);
    assert.equal(usage.data?.length, 2);
    assert.equal(usage.data?.[0].tokens, 5);
  } finally {
    assert.equal(
      (await db.from("demo_sessions").delete().eq("id", session)).error,
      null,
    );
  }
});

test("running AI route rejects malformed keys and foreign origins without provider calls", async () => {
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  for (const [key, origin, status] of [
    ["sk-invalid", base, 400],
    [`sk-${"a".repeat(40)}`, "https://other.example", 403],
  ] as const) {
    const response = await fetch(`${base}/api/retrieval`, {
      method: "POST",
      headers: {
        [OPENAI_KEY_HEADER]: key,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), new RegExp(key));
  }
});
