import { test } from "bun:test";
import assert from "node:assert/strict";
import { runVercelBuild } from "../scripts/vercel-build";

const production = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_REF: "main",
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_ACCESS_TOKEN: "test-management-token",
  SUPABASE_DB_PASSWORD: "test-database-password",
} satisfies Record<string, string | undefined>;

function harness(env: Record<string, string | undefined>, failAt = -1) {
  const calls: string[][] = [];
  const run = () =>
    runVercelBuild({
      env,
      log: () => {},
      run: (command, args) => {
        calls.push([command, ...args]);
        if (calls.length === failAt) throw new Error("Command failed.");
      },
    });
  return { calls, run };
}

test("local, preview, and development builds cannot run hosted migrations", () => {
  for (const env of [
    {},
    { ...production, VERCEL: undefined },
    { ...production, VERCEL_ENV: "preview" },
    { ...production, VERCEL_ENV: "development" },
    { ...production, VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "staging" },
  ]) {
    const check = harness(env);
    check.run();
    assert.deepEqual(check.calls, [["bun", "run", "build"]]);
  }
});

test("production builds finish compilation before migrations and bucket provisioning", () => {
  const check = harness(production);
  check.run();
  assert.deepEqual(check.calls, [
    ["bun", "run", "build"],
    [
      "npx",
      "--yes",
      "supabase@2.120.0",
      "link",
      "--project-ref",
      production.SUPABASE_PROJECT_REF,
    ],
    ["npx", "--yes", "supabase@2.120.0", "db", "push", "--linked", "--yes"],
    [
      "npx",
      "--yes",
      "supabase@2.120.0",
      "seed",
      "buckets",
      "--linked",
      "--yes",
    ],
  ]);
  assert.ok(
    !JSON.stringify(check.calls).includes(production.SUPABASE_ACCESS_TOKEN),
  );
  assert.ok(
    !JSON.stringify(check.calls).includes(production.SUPABASE_DB_PASSWORD),
  );
});

test("missing production settings fail before any command without disclosing secrets", () => {
  for (const name of [
    "SUPABASE_PROJECT_REF",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_PASSWORD",
    "SUPABASE_URL",
  ]) {
    const check = harness({ ...production, [name]: " " });
    assert.throws(check.run, (error: Error) => {
      assert.match(error.message, new RegExp(name));
      assert.ok(!error.message.includes(production.SUPABASE_ACCESS_TOKEN));
      assert.ok(!error.message.includes(production.SUPABASE_DB_PASSWORD));
      return true;
    });
    assert.equal(check.calls.length, 0);
  }
});

test("unknown environments, other branches, and mismatched projects fail closed", () => {
  for (const env of [
    { ...production, VERCEL_ENV: undefined },
    { ...production, VERCEL_ENV: "unknown" },
    { ...production, VERCEL_GIT_COMMIT_REF: "feature/unreviewed" },
    { ...production, SUPABASE_PROJECT_REF: "your-project" },
    { ...production, SUPABASE_URL: "http://127.0.0.1:54321" },
    { ...production, SUPABASE_URL: "https://wrongprojectabcdefgh.supabase.co" },
    { ...production, SUPABASE_URL: `${production.SUPABASE_URL}/rest/v1` },
    { ...production, SUPABASE_URL: "invalid" },
    {
      ...production,
      SUPABASE_URL: "https://user:password@abcdefghijklmnopqrst.supabase.co",
    },
  ]) {
    const check = harness(env);
    assert.throws(check.run);
    assert.equal(check.calls.length, 0);
  }
});

test("build, link, migration, or storage failure prevents every subsequent step", () => {
  for (const failAt of [1, 2, 3, 4]) {
    const check = harness(production, failAt);
    assert.throws(check.run, /Command failed/);
    assert.equal(check.calls.length, failAt);
  }
});
