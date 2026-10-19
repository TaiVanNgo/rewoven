import { afterEach, mock, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  personalKeyOptions,
  setPersonalKey,
} from "../src/features/ai-key/client";
import {
  isAIPath,
  OPENAI_KEY_HEADER,
  validPersonalKey,
} from "../src/features/ai-key/validation";

mock.module("server-only", () => ({}));
const { openAIKey, withOpenAIKey, providerError } =
  await import("../src/features/ai-key/server");
const { queryAIConfig, queryModel } =
  await import("../src/features/queries/server/openai");
const { caseAIConfig, suggestCase } =
  await import("../src/features/cases/server/openai");
const keyA = `sk-proj-${"a".repeat(40)}`;
const keyB = `sk-proj-${"b".repeat(40)}`;
afterEach(() => setPersonalKey(""));

test("personal keys are bounded and never accept header injection or an empty override", () => {
  assert.ok(validPersonalKey(keyA));
  for (const invalid of [
    "",
    "sk-short",
    `sk-${"a".repeat(510)}`,
    `${keyA}\nother`,
    ` ${keyA}`,
    "your-api-key",
  ])
    assert.equal(validPersonalKey(invalid), false);
});

const paths = [
  "/api/cases",
  "/api/cases/analyze",
  "/api/cases/id/read",
  "/api/cases/id/retry",
  "/api/sources/id/process",
  "/api/retrieval",
  "/api/queries/id/turns",
  "/api/queries/id/plans",
  "/api/plans/id/generate",
  "/api/query-files/id/process",
];
test("credentials go only to supported AI POST routes, and are removed immediately", () => {
  setPersonalKey(keyA);
  for (const path of paths) {
    assert.ok(isAIPath(path));
    const options = personalKeyOptions(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    assert.equal(new Headers(options.headers).get(OPENAI_KEY_HEADER), keyA);
    assert.equal(
      new Headers(options.headers).get("Content-Type"),
      "application/json",
    );
    assert.equal(options.redirect, "error");
    assert.equal(options.credentials, "same-origin");
  }
  for (const path of [
    "https://other.example/api/retrieval",
    "//other.example/api/retrieval",
    "/api/demo-session",
    "/api/queries",
    "/api/plans/id/export",
    "/api/retrieval?redirect=https://other.example",
    "/api/sources/id/original",
  ]) {
    assert.equal(
      new Headers(personalKeyOptions(path, { method: "POST" }).headers).has(
        OPENAI_KEY_HEADER,
      ),
      false,
    );
  }
  assert.equal(
    new Headers(personalKeyOptions(paths[0], { method: "GET" }).headers).has(
      OPENAI_KEY_HEADER,
    ),
    false,
  );
  setPersonalKey("");
  assert.equal(
    new Headers(personalKeyOptions(paths[0], { method: "POST" }).headers).has(
      OPENAI_KEY_HEADER,
    ),
    false,
  );
});

test("every billable browser route establishes a request-local credential scope", () => {
  for (const path of paths) {
    const route = path.replace("/id/", "/[id]/");
    const source = readFileSync(`src/app${route}/route.ts`, "utf8");
    assert.match(source, /export const POST = withOpenAIKey/);
  }
});

function request(key?: string, origin = "http://localhost") {
  return new Request("http://localhost/api/retrieval", {
    method: "POST",
    headers: {
      origin,
      ...(key === undefined ? {} : { [OPENAI_KEY_HEADER]: key }),
    },
  });
}
test("concurrent visitors and subsequent shared requests cannot inherit each other's keys", async () => {
  const shared = openAIKey();
  const handler = withOpenAIKey(async (request) => {
    const before = openAIKey();
    assert.equal(before, request.headers.get(OPENAI_KEY_HEADER));
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(openAIKey(), before);
    assert.equal(queryAIConfig()?.key, before);
    assert.equal(caseAIConfig().key, before);
    // The response must never serialize the credential.
    return Response.json({ personal: before !== shared });
  });
  const responses = await Promise.all([
    handler(request(keyA)),
    handler(request(keyB)),
  ]);
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /sk-/);
  }
  assert.equal(openAIKey(), shared);
  const fallback = withOpenAIKey(async () => {
    assert.equal(openAIKey(), shared);
    return Response.json({ ok: true });
  });
  assert.equal((await fallback(request())).status, 200);
});

test("invalid and foreign-origin credentials fail before the handler runs", async () => {
  let called = false;
  const handler = withOpenAIKey(async () => {
    called = true;
    return Response.json({});
  });
  for (const invalid of ["", "sk-invalid"])
    assert.equal((await handler(request(invalid))).status, 400);
  assert.equal(
    (await handler(request(keyA, "https://other.example"))).status,
    403,
  );
  assert.equal(called, false);
});

test("personal credentials reach chat and document transports; provider failure never retries with shared credit", async () => {
  let chatCalls = 0;
  let readingCalls = 0;
  const handler = withOpenAIKey(async () => {
    const config = queryAIConfig();
    assert.ok(config);
    await assert.rejects(
      queryModel("answer", {}, config, async (_url, init) => {
        chatCalls++;
        assert.equal(
          new Headers(init.headers).get("Authorization"),
          `Bearer ${keyA}`,
        );
        assert.doesNotMatch(String(init.body), /sk-/);
        return Response.json({ error: keyA }, { status: 401 });
      }),
      /Replace your key/,
    );
    await assert.rejects(
      suggestCase(
        [{ number: 1, text: "Project Beacon records support requests." }],
        false,
        caseAIConfig(),
        async (_url, init) => {
          readingCalls++;
          assert.equal(
            new Headers(init.headers).get("Authorization"),
            `Bearer ${keyA}`,
          );
          return Response.json({ error: keyA }, { status: 429 });
        },
      ),
      /your key's billing/,
    );
    const message = providerError(403, "answer").message;
    assert.doesNotMatch(message, new RegExp(keyA));
    return Response.json({ ok: true });
  });
  assert.equal((await handler(request(keyA))).status, 200);
  assert.equal(chatCalls, 1);
  assert.equal(readingCalls, 1);
});
