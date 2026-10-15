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
    evidence: [{ page: null, quote: "Project Beacon" }],
  },
  context: {
    value: "Tracks support requests.",
    evidence: [{ page: null, quote: "tracks support requests" }],
  },
  outcome: { value: "", evidence: [] },
  lessons: { value: "", evidence: [] },
};
const config = { key: "test-key", model: "test-model" };
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
    assert.deepEqual(JSON.parse(body.input[0].content).document_pages, pages);
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
test("PDF requests constrain references to actual pages and bound every quote and suggested field", async () => {
  const pdfPages = Array.from({ length: 11 }, (_, index) => ({
    number: index + 1,
    text: `Fictional engineering journal page ${index + 1}. Managers approve expenses.`,
  }));
  const output = {
    ...fields,
    title: {
      value: "Approval portal",
      evidence: [{ page: 11, quote: "Managers approve expenses." }],
    },
    context: { value: "", evidence: [] },
  };
  let requestBody = "";
  await suggestCase(pdfPages, true, config, async (_url, init) => {
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
  });
  const schema = JSON.parse(requestBody).text.format.schema;
  for (const name of ["title", "context", "outcome", "lessons"]) {
    const field = schema.properties[name];
    assert.equal(
      field.properties.value.maxLength,
      name === "title" ? 200 : 2000,
    );
    assert.equal(field.properties.evidence.maxItems, 3);
    const reference = field.properties.evidence.items.properties;
    assert.equal(reference.page.type, "integer");
    assert.equal(reference.page.minimum, 1);
    assert.equal(reference.page.maximum, 11);
    assert.equal(reference.quote.minLength, 1);
    assert.equal(reference.quote.maxLength, 600);
    assert.ok(new RegExp(reference.quote.pattern).test("Actual source quote"));
    assert.ok(!new RegExp(reference.quote.pattern).test(" \n "));
  }
});
test("plain-text requests require null source pages instead of leaving page format to the prompt", async () => {
  let requestBody = "";
  await suggestCase(pages, false, config, async (_url, init) => {
    requestBody = String(init.body);
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(fields) }],
        },
      ],
    });
  });
  const schema = JSON.parse(requestBody).text.format.schema;
  assert.deepEqual(
    schema.properties.title.properties.evidence.items.properties.page,
    { type: "null" },
  );
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
            content: [{ type: "output_text", text: JSON.stringify(fields) }],
          },
        ],
      }),
    ),
    /could not be verified/,
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
