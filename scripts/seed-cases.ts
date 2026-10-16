import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { overviewProjection } from "../src/features/cases/case-overview";
import { chunkPages } from "../src/features/cases/extraction";
import { legacySampleIds, loadSampleCatalog } from "./sample-catalog";
import { seedTarget } from "./seed-target";

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function seedSamples({
  production = false,
  afterSample,
}: { production?: boolean; afterSample?: (count: number) => void } = {}) {
  const { url, secret } = seedTarget(production);
  const db = createClient(url, secret, { auth: { persistSession: false } });
  // Validate the complete catalog before touching persistent data.
  const catalog = await loadSampleCatalog();
  let count = 0;
  for (const item of catalog) {
    const existing = await db
      .from("cases")
      .select("is_seed,status")
      .eq("id", item.id)
      .maybeSingle();
    check(existing.error);
    if (existing.data && !existing.data.is_seed)
      throw new Error("A sample identifier is occupied by a user case.");
    if (!existing.data)
      check(
        (
          await db.from("cases").insert({
            id: item.id,
            request_key: item.id,
            is_seed: true,
            sample_visible: false,
            title: item.fixture.title,
          })
        ).error,
      );
    const prior = await db
      .from("source_documents")
      .select("id,status")
      .eq("id", item.sourceId)
      .maybeSingle();
    check(prior.error);
    const upload = await db.storage
      .from("case-sources")
      .upload(item.path, item.bytes, {
        contentType:
          item.format === "pdf"
            ? "application/pdf"
            : "text/markdown; charset=utf-8",
        upsert: false,
      });
    if (upload.error) {
      if (String(upload.error.statusCode) !== "409") check(upload.error);
      const retained = await db.storage
        .from("case-sources")
        .download(item.path);
      check(retained.error);
      if (
        !retained.data ||
        createHash("sha256")
          .update(new Uint8Array(await retained.data.arrayBuffer()))
          .digest("hex") !== item.fixture.sha256
      )
        throw new Error("A retained original does not match its checksum.");
    }
    if (!prior.data || prior.data.status !== "ready") {
      check(
        (
          await db.from("source_documents").upsert(
            {
              id: item.sourceId,
              case_id: item.id,
              title: item.filename,
              format: item.format,
              version: 1,
              storage_path: item.path,
              extracted_text: item.extracted.text,
              pages: item.extracted.pages,
              warnings: item.extracted.warnings,
              status: "ready",
              byte_size: item.bytes.length,
              char_count: item.extracted.text.length,
              page_count: item.extracted.pages.length,
              extraction_cursor: item.extracted.pages.length,
            },
            { onConflict: "id" },
          )
        ).error,
      );
    }
    const chunks = chunkPages(item.extracted.pages, item.format).map(
      (chunk) => ({ ...chunk, source_id: item.sourceId }),
    );
    // Stable (source, ordinal) keys preserve IDs and existing embeddings on retry.
    check(
      (
        await db.from("source_chunks").upsert(chunks, {
          onConflict: "source_id,ordinal",
          ignoreDuplicates: true,
        })
      ).error,
    );
    check(
      (
        await db
          .from("cases")
          .update({
            title: item.fixture.title,
            ...overviewProjection(item.overview),
            overview: item.overview,
            overview_revision: 1,
            status: "ready",
            error_message: null,
          })
          .eq("id", item.id)
          .eq("is_seed", true)
      ).error,
    );
    afterSample?.(++count);
  }
  check(
    (
      await db.rpc("activate_sample_catalog", {
        p_new: catalog.map((s) => s.id),
        p_legacy: legacySampleIds,
      })
    ).error,
  );
  console.log(
    "Ready: 9 fictional project samples. Originals and legacy citation links preserved; no AI calls made.",
  );
}
if (import.meta.main)
  await seedSamples({ production: process.argv.includes("--production") });
