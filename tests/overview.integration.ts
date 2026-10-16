import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  emptyOverview,
  overviewStale,
} from "../src/features/cases/case-overview";
import { caseFields } from "../src/features/cases/case-reading";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";

mock.module("server-only", () => ({}));
const { advanceCaseReading, reviewCaseReading, saveCaseFields } =
  await import("../src/features/cases/server/case-reading");
const { createCaseShell, reserveSource, processSource } =
  await import("../src/features/cases/server/sources");
const { caseDetail } = await import("../src/features/cases/server/repository");
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);

test("structured reviews persist atomically, reject stale revisions, preserve corrections and mark added sources stale", async () => {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const owner = await db
    .from("demo_sessions")
    .insert({ token_hash: hashSessionToken(newSessionToken()) })
    .select("id")
    .single();
  assert.ok(owner.data);
  const sessionId = owner.data.id;
  try {
    const id = randomUUID();
    await createCaseShell(
      { requestKey: id, title: "Review integration" },
      sessionId,
    );
    const sourceId = randomUUID();
    await reserveSource(
      id,
      {
        requestKey: sourceId,
        title: "pilot.md",
        text: "The pilot measured 20 approvals in one office. Wider adoption is unknown.",
      },
      sessionId,
    );
    await processSource(sourceId, sessionId);
    const overview = emptyOverview();
    overview.classification = "project";
    overview.provenance = "ai";
    overview.sections.results = [
      {
        id: "result-1",
        text: "The pilot measured 20 approvals in one office.",
        origin: "source",
        evidence: [
          {
            page: null,
            quote:
              "The pilot measured 20 approvals in one office. Wider adoption is unknown.",
          },
        ],
      },
    ];
    const empty = { value: "", evidence: [] };
    const progress = await advanceCaseReading(id, sessionId, undefined, {
      read: async () => ({
        title: {
          value: "Review integration",
          evidence: [
            {
              page: null,
              quote:
                "The pilot measured 20 approvals in one office. Wider adoption is unknown.",
            },
          ],
        },
        context: empty,
        outcome: empty,
        lessons: empty,
        overview,
      }),
      merge: async () => {
        throw new Error("Single section should not merge");
      },
    });
    assert.equal(progress.status, "ready");
    assert.ok(progress.result?.suggestions.overview);
    const before = await caseDetail(id, sessionId);
    const reviewed = await reviewCaseReading(id, sessionId, {
      readingId: progress.id,
      fields: caseFields(before),
      expected: caseFields(before),
      overview: progress.result.suggestions.overview,
      expectedOverviewRevision: 0,
    });
    assert.equal(reviewed.overviewRevision, 1);
    assert.equal(
      reviewed.overview?.sections.results[0].evidence[0].sourceId,
      sourceId,
    );
    assert.equal(
      reviewed.overview?.sections.results[0].evidence[0].sourceVersion,
      1,
    );
    assert.match(reviewed.outcome, /20 approvals/);
    const edited = structuredClone(reviewed.overview);
    assert.ok(edited);
    edited.sections.results[0].text =
      "Contributor correction: observed in one office only.";
    edited.sections.results[0].evidence[0].quote = "Forged reference";
    const saved = await saveCaseFields(id, sessionId, {
      fields: caseFields(reviewed),
      expected: caseFields(reviewed),
      overview: edited,
      expectedOverviewRevision: 1,
    });
    assert.equal(saved.overviewRevision, 2);
    assert.equal(saved.overview?.sections.results[0].origin, "user");
    assert.deepEqual(saved.overview?.sections.results[0].evidence, []);
    assert.equal(
      saved.aiReview?.suggestions.overview?.sections.results[0].text,
      "The pilot measured 20 approvals in one office.",
    );
    await assert.rejects(
      saveCaseFields(id, sessionId, {
        fields: caseFields(saved),
        expected: caseFields(saved),
        overview: edited,
        expectedOverviewRevision: 1,
      }),
      /overview changed/,
    );
    await assert.rejects(
      saveCaseFields(id, sessionId, {
        fields: caseFields(saved),
        expected: caseFields(saved),
      }),
      /structured overview is required/,
    );
    await reserveSource(
      id,
      {
        requestKey: randomUUID(),
        title: "later.md",
        text: "A later note documents an additional review.",
      },
      sessionId,
    );
    const refreshed = await caseDetail(id, sessionId);
    assert.ok(refreshed.overview);
    assert.equal(overviewStale(refreshed.overview, refreshed.sources), true);
    assert.equal(
      refreshed.overview.sections.results[0].text,
      edited.sections.results[0].text,
    );
    await assert.rejects(
      reviewCaseReading(id, sessionId, {
        readingId: progress.id,
        fields: caseFields(refreshed),
        expected: caseFields(refreshed),
        overview: edited,
        expectedOverviewRevision: 2,
      }),
      /Sources changed/,
    );
  } finally {
    await db.from("demo_sessions").delete().eq("id", sessionId);
  }
});
