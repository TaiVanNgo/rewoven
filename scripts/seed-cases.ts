import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chunkPages, extractSource } from "../src/features/cases/extraction";
import type { SourceFormat } from "../src/features/cases/types";
import { seedTarget } from "./seed-target";

const { url, secret } = seedTarget(process.argv.includes("--production"));
const db = createClient(url, secret, { auth: { persistSession: false } });
const folder = new URL("../supabase/fixtures/", import.meta.url);
type SeedCase = {
  title: string;
  context: string;
  outcome?: string;
  lessons?: string;
  sources: string[];
};
const cases: SeedCase[] = JSON.parse(
  await readFile(new URL("cases.json", folder), "utf8"),
);
function idFor(value: string) {
  const h = createHash("sha256")
    .update(`rewoven-seed-v1:${value}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
for (const item of cases) {
  const id = idFor(item.title);
  const existing = await db
    .from("cases")
    .select("is_seed,status")
    .eq("id", id)
    .maybeSingle();
  check(existing.error);
  if (existing.data?.is_seed && existing.data.status === "ready") continue;
  if (existing.data && !existing.data.is_seed)
    throw new Error("A seed ID is already occupied by a user case.");
  if (!existing.data)
    check(
      (
        await db.from("cases").insert({
          id,
          request_key: id,
          is_seed: true,
          title: item.title,
          context: item.context,
          outcome: item.outcome ?? "",
          lessons: item.lessons ?? "",
        })
      ).error,
    );
  for (const filename of item.sources) {
    const sourceId = idFor(`${item.title}/${filename}`);
    const path = `seeds/${id}/${sourceId}/${filename}`;
    const format = filename.split(".").pop() as SourceFormat;
    const bytes = new Uint8Array(await readFile(new URL(filename, folder)));
    const extracted = await extractSource(bytes, format);
    const uploaded = await db.storage.from("case-sources").upload(path, bytes, {
      contentType:
        format === "pdf" ? "application/pdf" : "text/plain; charset=utf-8",
      upsert: false,
    });
    if (uploaded.error && uploaded.error.statusCode !== "409")
      check(uploaded.error);
    check(
      (
        await db.from("source_documents").upsert(
          {
            id: sourceId,
            case_id: id,
            title:
              filename === "delivery-notes.pdf"
                ? "Delivery notes.pdf"
                : filename,
            format,
            storage_path: path,
            extracted_text: extracted.text,
            pages: extracted.pages,
            warnings: extracted.warnings,
          },
          { onConflict: "id" },
        )
      ).error,
    );
    check(
      (await db.from("source_chunks").delete().eq("source_id", sourceId)).error,
    );
    check(
      (
        await db.from("source_chunks").insert(
          chunkPages(extracted.pages, format).map((chunk) => ({
            ...chunk,
            source_id: sourceId,
          })),
        )
      ).error,
    );
  }
  check(
    (
      await db
        .from("cases")
        .update({ status: "ready", error_message: null })
        .eq("id", id)
    ).error,
  );
}
console.log(
  `Ready: ${cases.length} fictional sample cases. Existing ready seeds were preserved.`,
);
