import { test } from "bun:test";
import assert from "node:assert/strict";
import { seedTarget } from "../scripts/seed-target";

const hosted = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_REF: "main",
  SEED_SAMPLE_CASES: "true",
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_SECRET_KEY: "test-server-key",
} satisfies Record<string, string | undefined>;

test("ordinary seeding stays local even with hosted opt-in settings", () => {
  assert.throws(() => seedTarget(false, hosted), /only targets local/);
  for (const hostname of ["localhost", "127.0.0.1"]) {
    const env = { ...hosted, SUPABASE_URL: `http://${hostname}:54321` };
    assert.deepEqual(seedTarget(false, env), {
      url: env.SUPABASE_URL,
      secret: env.SUPABASE_SECRET_KEY,
    });
  }
});

test("hosted seeding needs an explicit Production opt-in and matching project", () => {
  assert.equal(seedTarget(true, hosted).url, hosted.SUPABASE_URL);
  for (const env of [
    { ...hosted, VERCEL: undefined },
    { ...hosted, VERCEL_ENV: "preview" },
    { ...hosted, VERCEL_ENV: "development" },
    { ...hosted, VERCEL_GIT_COMMIT_REF: "feature/samples" },
    { ...hosted, SEED_SAMPLE_CASES: undefined },
    { ...hosted, SEED_SAMPLE_CASES: "false" },
    { ...hosted, SUPABASE_PROJECT_REF: "wrong" },
    { ...hosted, SUPABASE_URL: "http://127.0.0.1:54321" },
    { ...hosted, SUPABASE_URL: `${hosted.SUPABASE_URL}/rest/v1` },
    { ...hosted, SUPABASE_URL: `${hosted.SUPABASE_URL}?project=other` },
    { ...hosted, SUPABASE_URL: "https://wrongprojectabcdefgh.supabase.co" },
    { ...hosted, SUPABASE_SECRET_KEY: " " },
  ])
    assert.throws(() => seedTarget(true, env));
});
