import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import type { OpenAITransport } from "../src/features/cases/server/openai";

mock.module("server-only", () => ({}));
const { suggestCase, caseAIConfig } =
  await import("../src/features/cases/server/openai");
const { sourceInput } =
  await import("../src/features/cases/server/source-input");
const pages = [
  {
    number: 1,
    text: "Project Beacon tracks support requests. No outcome recorded.",
  },
];
const fields = {
  title: {
    value: "Project Beacon",
    evidence: [1],
  },
  context: {
    value: "Tracks support requests.",
    evidence: [1],
  },
  outcome: { value: "", evidence: [] },
  lessons: { value: "", evidence: [] },
};
const config = { key: "test-key", model: "test-model" };
test("resolves three PDF context citations from server excerpts without model-copied quotes", async () => {
  const pdfPages = [
    { number: 1, text: "Project Beacon tracks support requests." },
    { number: 2, text: "Managers approve expenses." },
    { number: 3, text: "No outcome recorded." },
  ];
  const result = await suggestCase(
    pdfPages,
    true,
    config,
    async (_url, init) => {
      const body = JSON.parse(String(init.body));
      const excerpts = JSON.parse(body.input[0].content).source_excerpts;
      assert.ok(
        Array.isArray(excerpts),
        "The model must select supplied excerpts, rather than copy quotes.",
      );
      const output = {
        title: { value: "Project Beacon", evidence: [excerpts[0].id] },
        context: {
          value: "An approval project with no recorded outcome.",
          evidence: excerpts.map((entry: { id: number }) => entry.id),
        },
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
  assert.deepEqual(
    result.context.evidence,
    pdfPages.map((page) => ({ page: page.number, quote: page.text })),
  );
});
function transport(body: unknown, status = 200): OpenAITransport {
  return (async () => Response.json(body, { status })) as OpenAITransport;
}
test("sends untrusted document input with strict schema, no response storage, and a timeout", async () => {
  const result = await suggestCase(pages, false, config, (async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.model, "test-model");
    assert.match(body.instructions, /untrusted evidence/);
    assert.match(body.instructions, /never goals, planned benefits/);
    assert.deepEqual(JSON.parse(body.input[0].content).source_excerpts, [
      { id: 1, page: null, quote: pages[0].text },
    ]);
    assert.ok(init?.signal);
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer test-key",
    );
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(fields) }],
        },
      ],
    });
  }) as OpenAITransport);
  assert.equal(result.outcome.value, "");
});
test("constrains evidence IDs to the supplied excerpts and bounds suggested fields", async () => {
  const pdfPages = Array.from({ length: 11 }, (_, index) => ({
    number: index + 1,
    text: `Fictional engineering journal page ${index + 1}. Managers approve expenses.`,
  }));
  const output = {
    ...fields,
    title: { value: "Approval portal", evidence: [11] },
    context: { value: "", evidence: [] },
  };
  let requestBody = "";
  const result = await suggestCase(
    pdfPages,
    true,
    config,
    async (_url, init) => {
      requestBody = String(init.body);
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
  const schema = JSON.parse(requestBody).text.format.schema;
  for (const name of ["title", "context", "outcome", "lessons"]) {
    const field = schema.properties[name];
    assert.equal(
      field.properties.value.maxLength,
      name === "title" ? 200 : 2000,
    );
    assert.equal(field.properties.evidence.maxItems, 3);
    assert.deepEqual(field.properties.evidence.items, {
      type: "integer",
      minimum: 1,
      maximum: 11,
    });
  }
  assert.deepEqual(result.title.evidence, [
    { page: 11, quote: pdfPages[10].text },
  ]);
});
test("rejects invalid excerpt IDs without trusting model-supplied quotes or pages", async () => {
  for (const id of [
    0,
    -1,
    2,
    1.5,
    "1",
    null,
    { page: null, quote: pages[0].text },
  ]) {
    await assert.rejects(
      suggestCase(
        pages,
        false,
        config,
        transport({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    ...fields,
                    context: { value: "Context", evidence: [1, 1, id] },
                  }),
                },
              ],
            },
          ],
        }),
      ),
      /AI context reference 3 does not identify a supplied source excerpt/,
    );
  }
});
test("rejects empty sources before contacting OpenAI", async () => {
  let calls = 0;
  await assert.rejects(
    suggestCase([{ number: 1, text: " " }], true, config, async () => {
      calls++;
      return Response.json({});
    }),
    /no readable text/,
  );
  assert.equal(calls, 0);
});

test("handles refusal, incomplete output, malformed JSON, and fabricated references", async () => {
  await assert.rejects(
    suggestCase(
      pages,
      false,
      config,
      transport({
        status: "completed",
        output: [{ type: "message", content: [{ type: "refusal" }] }],
      }),
    ),
    /could not suggest/,
  );
  await assert.rejects(
    suggestCase(
      pages,
      false,
      config,
      transport({ status: "incomplete", output: [] }),
    ),
    /did not finish/,
  );
  await assert.rejects(
    suggestCase(
      pages,
      false,
      config,
      transport({
        status: "completed",
        output: [
          { type: "message", content: [{ type: "output_text", text: "{" }] },
        ],
      }),
    ),
    /unreadable answer/,
  );
  await assert.rejects(
    suggestCase(
      [{ number: 1, text: "Unrelated text" }],
      false,
      config,
      transport({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  ...fields,
                  title: { value: "Fabricated", evidence: [2] },
                }),
              },
            ],
          },
        ],
      }),
    ),
    /does not identify a supplied source excerpt/,
  );
});
test("provider failures and aborts never leak payloads or credentials", async () => {
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(
      suggestCase(
        pages,
        false,
        config,
        transport({ error: "private-provider-detail test-key" }, status),
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.doesNotMatch(error.message, /private-provider-detail|test-key/);
        return true;
      },
    );
  }
  await assert.rejects(
    suggestCase(pages, false, config, (async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as OpenAITransport),
    /timed out or could not connect/,
  );
});
test("source fingerprints bind exact originals and source formats", async () => {
  const form = new FormData();
  form.set("mode", "text");
  form.set("text", "Project Beacon");
  const original = await sourceInput(form);
  assert.equal(original.hash, (await sourceInput(form)).hash);
  form.set("text", "Project Beacon ");
  assert.notEqual(original.hash, (await sourceInput(form)).hash);
  form.set("mode", "file");
  form.set("file", new File(["Project Beacon"], "source.md"));
  assert.notEqual(original.hash, (await sourceInput(form)).hash);
  form.append("file", new File(["other"], "source2.md"));
  await assert.rejects(sourceInput(form), /one source file/);
});
test("missing keys and invalid budget configuration fail closed", () => {
  const saved = {
    key: process.env.OPENAI_API_KEY,
    limit: process.env.AI_CASE_SESSION_LIMIT,
  };
  try {
    delete process.env.OPENAI_API_KEY;
    assert.throws(caseAIConfig, /not configured/);
    process.env.OPENAI_API_KEY = "test-key";
    process.env.AI_CASE_SESSION_LIMIT = "-1";
    assert.throws(caseAIConfig, /misconfigured/);
    process.env.AI_CASE_SESSION_LIMIT = "0";
    assert.equal(caseAIConfig().sessionLimit, 0);
  } finally {
    if (saved.key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved.key;
    if (saved.limit === undefined) delete process.env.AI_CASE_SESSION_LIMIT;
    else process.env.AI_CASE_SESSION_LIMIT = saved.limit;
  }
});

test("production defaults to 50 session attempts and 100 daily, while development has neither limit", () => {
  const names = [
    "NODE_ENV",
    "OPENAI_API_KEY",
    "AI_CASE_SESSION_LIMIT",
    "AI_CASE_DAILY_LIMIT",
  ] as const;
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  try {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.AI_CASE_SESSION_LIMIT;
    delete process.env.AI_CASE_DAILY_LIMIT;
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal(caseAIConfig().sessionLimit, 50);
    assert.equal(caseAIConfig().dailyLimit, 100);
    // next start is production mode even when the server is on localhost.
    process.env.AI_CASE_SESSION_LIMIT = "0";
    process.env.AI_CASE_DAILY_LIMIT = "0";
    assert.equal(caseAIConfig().sessionLimit, 0);
    assert.equal(caseAIConfig().dailyLimit, 0);
    Object.assign(process.env, { NODE_ENV: "development" });
    assert.equal(caseAIConfig().sessionLimit, null);
    assert.equal(caseAIConfig().dailyLimit, null);
    Object.assign(process.env, { NODE_ENV: "test" });
    delete process.env.AI_CASE_SESSION_LIMIT;
    delete process.env.AI_CASE_DAILY_LIMIT;
    assert.equal(caseAIConfig().sessionLimit, 50);
    assert.equal(caseAIConfig().dailyLimit, 100);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
