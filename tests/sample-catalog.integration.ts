import { test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { legacySampleIds, loadSampleCatalog } from "../scripts/sample-catalog";
import { seedSamples } from "../scripts/seed-cases";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";

const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
test("catalog replacement is resumable and preserves user cases, chunk IDs, originals and retired citation links", async () => {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const catalog = await loadSampleCatalog();
  const legacyId = legacySampleIds[0];
  const legacy = await db
    .from("cases")
    .select("id")
    .eq("id", legacyId)
    .maybeSingle();
  if (!legacy.data) {
    const created = await db.from("cases").insert({
      id: legacyId,
      request_key: legacyId,
      is_seed: true,
      title: "Expense Approval Portal",
      status: "ready",
    });
    assert.equal(created.error, null);
    const oldSource = await db.from("source_documents").insert({
      id: randomUUID(),
      case_id: legacyId,
      title: "Legacy retained source",
      format: "text",
      original_text: "Retained legacy evidence.",
      extracted_text: "Retained legacy evidence.",
      pages: [{ number: 1, text: "Retained legacy evidence." }],
      status: "ready",
    });
    assert.equal(oldSource.error, null);
  }
  const token = newSessionToken();
  const owner = await db
    .from("demo_sessions")
    .insert({ token_hash: hashSessionToken(token) })
    .select("id")
    .single();
  assert.ok(owner.data);
  const userId = randomUUID();
  const inserted = await db.from("cases").insert({
    id: userId,
    request_key: userId,
    session_id: owner.data.id,
    title: "Preserve this user case",
    context: "Contributor content",
    status: "ready",
  });
  assert.equal(inserted.error, null);
  const cookie = { Cookie: `rewoven-session=${token}` };
  try {
    // Model the old catalog before replacement without deleting stored records.
    assert.equal(
      (
        await db
          .from("cases")
          .update({ sample_visible: false })
          .in(
            "id",
            catalog.map((c) => c.id),
          )
          .eq("is_seed", true)
      ).error,
      null,
    );
    assert.equal(
      (
        await db
          .from("cases")
          .update({ sample_visible: true })
          .eq("id", legacyId)
      ).error,
      null,
    );
    await assert.rejects(
      seedSamples({
        afterSample: (count) => {
          if (count === 1) throw new Error("Injected interruption");
        },
      }),
      /Injected interruption/,
    );
    const interrupted = (
      await (await fetch(`${base}/api/cases`, { headers: cookie })).json()
    ).cases;
    assert.ok(interrupted.some((c: { id: string }) => c.id === legacyId));
    assert.ok(interrupted.some((c: { id: string }) => c.id === userId));
    await seedSamples();
    const published = (
      await (await fetch(`${base}/api/cases`, { headers: cookie })).json()
    ).cases;
    assert.equal(
      published.filter((c: { is_seed: boolean }) => c.is_seed).length,
      9,
    );
    assert.ok(!published.some((c: { id: string }) => c.id === legacyId));
    assert.ok(
      published.some(
        (c: { id: string; context: string }) =>
          c.id === userId && c.context === "Contributor content",
      ),
    );
    const retained = await fetch(`${base}/api/cases/${legacyId}`, {
      headers: cookie,
    });
    assert.equal(retained.status, 200);
    const old = (await retained.json()).case;
    assert.ok(old.sources.length);
    assert.equal(
      (
        await fetch(`${base}/api/sources/${old.sources[0].id}/original`, {
          headers: cookie,
        })
      ).status,
      200,
    );
    const before = await db
      .from("source_chunks")
      .select("id")
      .eq("source_id", catalog[0].sourceId)
      .order("ordinal");
    assert.equal(before.error, null);
    await seedSamples();
    const after = await db
      .from("source_chunks")
      .select("id")
      .eq("source_id", catalog[0].sourceId)
      .order("ordinal");
    assert.deepEqual(after.data, before.data);
    const original = await db.storage
      .from("case-sources")
      .download(catalog[0].path);
    assert.ok(original.data);
    assert.deepEqual(
      new Uint8Array(await original.data.arrayBuffer()),
      catalog[0].bytes,
    );
  } finally {
    await db.from("demo_sessions").delete().eq("id", owner.data.id);
    await seedSamples();
  }
}, 30000);
