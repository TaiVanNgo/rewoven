import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  caseFields,
  type ReadingProgress,
} from "../src/features/cases/case-reading";
import type { CaseSuggestions } from "../src/features/cases/case-suggestions";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";

mock.module("server-only", () => ({}));
const {
  advanceCaseReading,
  reviewCaseReading,
  combineReadings,
  saveCaseFields,
} = await import("../src/features/cases/server/case-reading");
const { createCaseShell, reserveSource, processSource } =
  await import("../src/features/cases/server/sources");
const { caseDetail } = await import("../src/features/cases/server/repository");
const { suggestExcerpts } = await import("../src/features/cases/server/openai");
const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const empty = {
  title: { value: "", evidence: [] },
  context: { value: "", evidence: [] },
  outcome: { value: "", evidence: [] },
  lessons: { value: "", evidence: [] },
};

test("large multi-document reading checkpoints, resumes, cites originals, caches, and applies reviewed edits atomically", async () => {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const owners: string[] = [];
  async function session() {
    const token = newSessionToken();
    const result = await db
      .from("demo_sessions")
      .insert({ token_hash: hashSessionToken(token) })
      .select("id")
      .single();
    assert.ok(result.data);
    owners.push(result.data.id);
    return { id: result.data.id, cookie: `rewoven-session=${token}` };
  }
  try {
    const owner = await session(),
      other = await session(),
      id = randomUUID();
    const initial = await createCaseShell(
      { requestKey: id, title: "AI reading in progress" },
      owner.id,
    );
    const introduction = "Cedar project requirements. ",
      ending = "The project plans automated alerts.";
    const text =
      introduction +
      "Background documentation for the Cedar project. "
        .repeat(11000)
        .slice(0, 500000 - introduction.length - ending.length) +
      ending;
    assert.equal(text.length, 500000);
    assert.ok(text.length > 50000);
    const a = randomUUID(),
      b = randomUUID();
    await reserveSource(id, { requestKey: a, title: "SRS.md", text }, owner.id);
    await reserveSource(
      id,
      {
        requestKey: b,
        title: "Retrospective.txt",
        text: "Cedar retrospective. Actual result: alerts were postponed. End marker DELIVERED_FAIL. Lesson: verify the rollout scope.",
      },
      owner.id,
    );
    await processSource(a, owner.id);
    await processSource(b, owner.id);
    let mapCalls = 0,
      mergeCalls = 0,
      fail = false;
    let releaseFirst!: () => void;
    let notifyFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      notifyFirst = resolve;
    });
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const seen: string[] = [];
    const readers = {
      read: async (...args: Parameters<typeof suggestExcerpts>) => {
        mapCalls++;
        if (mapCalls === 1) {
          notifyFirst();
          await firstReleased;
        }
        if (fail) {
          fail = false;
          throw new Error("Injected transient outage");
        }
        const [excerpts, pages, isPdf, config] = args;
        seen.push(excerpts[0].quote);
        return suggestExcerpts(excerpts, pages, isPdf, config, async () => {
          const actual = excerpts.find((e) =>
            e.quote.includes("DELIVERED_FAIL"),
          );
          return Response.json({
            status: "completed",
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      ...empty,
                      title: { value: "Cedar project", evidence: [1] },
                      context: {
                        value: "Documented Cedar delivery scope.",
                        evidence: [1],
                      },
                      ...(actual
                        ? {
                            outcome: {
                              value: "Alerts were postponed.",
                              evidence: [actual.id],
                            },
                            lessons: {
                              value: "Verify the rollout scope.",
                              evidence: [actual.id],
                            },
                          }
                        : {}),
                    }),
                  },
                ],
              },
            ],
          });
        });
      },
      merge: async (
        drafts: CaseSuggestions[],
        config: { key: string; model: string },
      ) => {
        mergeCalls++;
        return combineReadings(drafts, config, async (_url, init) => {
          const body = JSON.parse(String(init.body)),
            input = JSON.parse(body.input[0].content);
          const refs = input.source_excerpts as { id: number; quote: string }[];
          const actual = refs.find((e) => e.quote.includes("DELIVERED_FAIL"));
          return Response.json({
            status: "completed",
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      ...empty,
                      title: { value: "Cedar project", evidence: [1] },
                      context: {
                        value:
                          "Planned alerts differ from the recorded delivery.",
                        evidence: actual ? [1, actual.id] : [1],
                      },
                      ...(actual
                        ? {
                            outcome: {
                              value: "Alerts were postponed.",
                              evidence: [actual.id],
                            },
                            lessons: {
                              value: "Verify the rollout scope.",
                              evidence: [actual.id],
                            },
                          }
                        : {}),
                    }),
                  },
                ],
              },
            ],
          });
        });
      },
    };
    const firstStep = advanceCaseReading(id, owner.id, undefined, readers);
    await firstStarted;
    const concurrent = await advanceCaseReading(
      id,
      owner.id,
      undefined,
      readers,
    );
    assert.equal(concurrent.status, "processing");
    assert.equal(
      mapCalls,
      1,
      "Concurrent readers cannot repeat an active provider step",
    );
    releaseFirst();
    let progress = await firstStep;
    assert.equal(progress.completed, 1);
    const readingId = progress.id;
    fail = true;
    await assert.rejects(
      advanceCaseReading(id, owner.id, readingId, readers),
      /transient outage/,
    );
    const checkpoint = await db
      .from("case_ai_readings")
      .select("work,status")
      .eq("id", readingId)
      .single();
    assert.equal(checkpoint.data?.status, "failed");
    assert.equal(checkpoint.data?.work.cursor, 1);
    for (let i = 0; i < 100 && progress.status !== "ready"; i++)
      progress = await advanceCaseReading(id, owner.id, readingId, readers);
    assert.equal(progress.status, "ready");
    assert.ok(progress.total > 3);
    assert.ok(mergeCalls > 0);
    assert.equal(
      progress.result?.suggestions.outcome.value,
      "Alerts were postponed.",
    );
    assert.equal(
      seen.filter((value) => value.startsWith("Cedar project requirements."))
        .length,
      1,
    );
    const calls = mapCalls + mergeCalls;
    assert.equal(
      (await advanceCaseReading(id, owner.id, readingId, readers)).id,
      readingId,
    );
    assert.equal(mapCalls + mergeCalls, calls);
    const attempts = await db
      .from("case_ai_attempts")
      .select("id", { count: "exact", head: true })
      .eq("reading_id", readingId);
    assert.equal(attempts.count, 2);
    const response = await fetch(`${base}/api/cases/${id}/read`, {
      method: "POST",
      headers: { Cookie: owner.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ readingId }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(((await response.json()) as ReadingProgress).status, "ready");
    assert.equal(
      (
        await fetch(`${base}/api/cases/${id}/read`, {
          method: "POST",
          headers: { Cookie: other.cookie, "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      404,
    );
    const draft = progress.result;
    assert.ok(draft);
    for (const field of [
      draft.suggestions.title,
      draft.suggestions.context,
      draft.suggestions.outcome,
      draft.suggestions.lessons,
    ])
      for (const evidence of field.evidence) {
        const original = await db
          .from("source_documents")
          .select("pages")
          .eq("id", evidence.sourceId)
          .single();
        assert.ok(
          original.data?.pages.some((p: { text: string }) =>
            p.text.includes(evidence.quote),
          ),
        );
      }
    const input = {
      readingId,
      fields: {
        title: "Reviewed Cedar project",
        context: draft.suggestions.context.value,
        outcome: draft.suggestions.outcome.value,
        lessons: "My reviewed lesson",
      },
      expected: caseFields(initial),
    };
    const reviewed = await reviewCaseReading(id, owner.id, input);
    assert.equal(reviewed.title, "Reviewed Cedar project");
    assert.equal(reviewed.lessons, "My reviewed lesson");
    assert.equal(reviewed.aiReview?.suggestions.title.value, "Cedar project");
    assert.ok(
      reviewed.aiReview?.suggestions.outcome.evidence.some(
        (e) => e.sourceId === b,
      ),
    );
    await assert.rejects(
      reviewCaseReading(id, owner.id, input),
      /details changed/,
    );
    const c = randomUUID();
    await reserveSource(
      id,
      { requestKey: c, title: "Later minutes", text: "Later scope notes." },
      owner.id,
    );
    await processSource(c, owner.id);
    await assert.rejects(
      reviewCaseReading(id, owner.id, {
        ...input,
        expected: caseFields(reviewed),
      }),
      /Sources changed/,
    );
    const reloaded = await caseDetail(id, owner.id);
    assert.equal(reloaded.lessons, "My reviewed lesson");
    assert.equal(reloaded.aiReview?.id, readingId);
    await assert.rejects(
      advanceCaseReading(id, owner.id, readingId, readers),
      /Sources or reader settings changed/,
    );
    const saved = await saveCaseFields(id, owner.id, {
      fields: {
        ...caseFields(reloaded),
        title: "Manual fallback remains editable",
      },
      expected: caseFields(reloaded),
    });
    assert.equal(saved.title, "Manual fallback remains editable");
  } finally {
    for (const id of owners)
      await db.from("demo_sessions").delete().eq("id", id);
  }
}, 60000);
