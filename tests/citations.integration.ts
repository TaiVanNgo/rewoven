import { test } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  hashSessionToken,
  newSessionToken,
} from "../src/features/cases/session-token";
import type { SourcePreview } from "../src/features/citations/types";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("source previews isolate sessions, retain page context, guard versions and sign private originals", async () => {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.SUPABASE_URL ?? "").hostname,
    ),
  );
  const db = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SECRET_KEY ?? "",
    { auth: { persistSession: false } },
  );
  const sessions: string[] = [],
    paths: string[] = [];
  async function session() {
    const token = newSessionToken();
    const result = await db
      .from("demo_sessions")
      .insert({ token_hash: hashSessionToken(token) })
      .select("id")
      .single();
    assert.ifError(result.error);
    sessions.push(result.data.id);
    return { id: result.data.id, cookie: `rewoven-session=${token}` };
  }
  async function api(cookie: string, path: string) {
    return fetch(`${base}${path}`, { headers: { Cookie: cookie } });
  }
  try {
    const owner = await session(),
      foreign = await session();
    const caseId = randomUUID(),
      sourceId = randomUUID(),
      pdfId = randomUUID();
    assert.ifError(
      (
        await db.from("cases").insert({
          id: caseId,
          session_id: owner.id,
          request_key: caseId,
          title: "Citation integration",
          status: "ready",
        })
      ).error,
    );
    const text = `Opening context. ${"word ".repeat(1000)}The pilot\nmeasured twenty approvals. Closing context.`;
    assert.ifError(
      (
        await db.from("source_documents").insert({
          id: sourceId,
          case_id: caseId,
          title: "retro.md",
          format: "md",
          version: 2,
          original_text: text,
          extracted_text: text,
          pages: [{ number: 1, text }],
          page_count: 1,
          status: "ready",
        })
      ).error,
    );
    const quote = "The pilot measured twenty approvals.";
    const previewPath = `/api/sources/${sourceId}/preview?version=2&quote=${encodeURIComponent(quote)}`;
    const response = await api(owner.cookie, previewPath);
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const preview = (await response.json()) as SourcePreview;
    assert.equal(preview.source.version, 2);
    assert.equal(preview.pdfUrl, null);
    assert.ok(preview.highlight);
    assert.equal(
      preview.text.slice(preview.highlight.start, preview.highlight.end),
      "The pilot\nmeasured twenty approvals.",
    );
    assert.equal((await api(foreign.cookie, previewPath)).status, 404);
    assert.equal((await api("", previewPath)).status, 401);
    for (const suffix of ["preview?version=1", "original?version=1"])
      assert.equal(
        (await api(owner.cookie, `/api/sources/${sourceId}/${suffix}`)).status,
        409,
      );
    for (const query of [
      "page=0",
      "page=2",
      "start=0&end=999999",
      "version=NaN",
    ])
      assert.equal(
        (await api(owner.cookie, `/api/sources/${sourceId}/preview?${query}`))
          .status,
        400,
      );
    assert.equal(
      (await api(owner.cookie, `/api/sources/${sourceId}/original`)).status,
      200,
    );
    assert.equal(
      (await api(owner.cookie, `/api/sources/${randomUUID()}/preview`)).status,
      404,
    );
    const storagePath = `${owner.id}/${caseId}/${pdfId}.pdf`;
    paths.push(storagePath);
    const bytes = await readFile("tests/fixtures/mixed-pages.pdf");
    assert.ifError(
      (
        await db.storage
          .from("case-sources")
          .upload(storagePath, bytes, { contentType: "application/pdf" })
      ).error,
    );
    assert.ifError(
      (
        await db.from("source_documents").insert({
          id: pdfId,
          case_id: caseId,
          title: "mixed-pages.pdf",
          format: "pdf",
          version: 1,
          storage_path: storagePath,
          status: "ready",
          page_count: 3,
          pages: [
            { number: 1, text: "First page." },
            { number: 2, text: "" },
            { number: 3, text: "Final page." },
          ],
        })
      ).error,
    );
    const pdfResponse = await api(
      owner.cookie,
      `/api/sources/${pdfId}/preview?version=1&page=3`,
    );
    assert.equal(pdfResponse.status, 200, await pdfResponse.clone().text());
    const pdf = (await pdfResponse.json()) as SourcePreview;
    assert.equal(pdf.page, 3);
    assert.equal(pdf.text, "Final page.");
    assert.ok(pdf.pdfUrl);
    const original = await fetch(pdf.pdfUrl);
    assert.equal(original.status, 200);
    assert.deepEqual(
      new Uint8Array(await original.arrayBuffer()),
      new Uint8Array(bytes),
    );
    const blank = (await (
      await api(owner.cookie, `/api/sources/${pdfId}/preview?page=2`)
    ).json()) as SourcePreview;
    assert.equal(blank.text, "");
    assert.equal(blank.highlight, null);
    assert.equal(
      (await api(foreign.cookie, `/api/sources/${pdfId}/preview`)).status,
      404,
    );
  } finally {
    if (paths.length) await db.storage.from("case-sources").remove(paths);
    if (sessions.length)
      await db.from("demo_sessions").delete().in("id", sessions);
  }
});
