import { mock, test } from "bun:test";
import assert from "node:assert/strict";

mock.module("server-only", () => ({}));
const { queryModel } = await import("../src/features/queries/server/openai");
const config = {
  key: "test-only",
  model: "gpt-4.1-mini-2025-04-14",
  sessionLimit: 50,
  dailyLimit: 100,
};
test("chat transport uses strict structured output and disables provider persistence", async () => {
  let payload: Record<string, unknown> = {};
  const result = await queryModel(
    "answer",
    { question: "What happened?" },
    config,
    async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      payload = JSON.parse(String(init.body));
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: '{"sections":[]}' }],
          },
        ],
      });
    },
  );
  assert.equal(payload.store, false);
  assert.equal(
    (payload.text as { format: { strict: boolean } }).format.strict,
    true,
  );
  assert.deepEqual(result, { sections: [] });
});
test("chat transport handles refusal, incomplete output, malformed JSON and provider failures", async () => {
  for (const response of [
    Response.json({
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal" }] }],
    }),
    Response.json({ status: "incomplete", output: [] }),
    Response.json({
      status: "completed",
      output: [
        { type: "message", content: [{ type: "output_text", text: "broken" }] },
      ],
    }),
    Response.json({ error: "quota" }, { status: 429 }),
  ])
    await assert.rejects(
      queryModel("answer", {}, config, async () => response),
    );
  await assert.rejects(
    queryModel("answer", {}, config, async () => {
      throw new Error("network timeout");
    }),
    /timed out/,
  );
});
