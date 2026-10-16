import { createClient } from "@supabase/supabase-js";
import { processSource } from "../src/features/cases/server/sources";

const url = process.env.SUPABASE_URL ?? "",
  key = process.env.SUPABASE_SECRET_KEY ?? "";
const target = new URL(url);
const local = ["127.0.0.1", "localhost"].includes(target.hostname);
const reference = process.argv
  .find((arg) => arg.startsWith("--project-ref="))
  ?.split("=")[1];
if (
  !local &&
  (!reference ||
    !/^[a-z0-9]{20}$/.test(reference) ||
    target.origin !== `https://${reference}.supabase.co`)
)
  throw new Error(
    "Hosted backfill requires --project-ref=<configured project reference> matching SUPABASE_URL.",
  );
const db = createClient(url, key, { auth: { persistSession: false } });
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
const embed = process.argv.includes("--embed");
let cursor = "",
  count = 0,
  indexed = 0,
  failed = 0;
for (;;) {
  const result = await db
    .from("source_documents")
    .select(
      "id,case_id,original_text,storage_path,byte_size,status,indexing_status,cases!inner(is_seed,session_id,demo_sessions(expires_at))",
    )
    .gt("id", cursor || "00000000-0000-0000-0000-000000000000")
    .order("id")
    .limit(100);
  check(result.error);
  if (!result.data?.length) break;
  for (const source of result.data) {
    if (source.byte_size === null) {
      let size: number;
      if (source.original_text !== null)
        size = new TextEncoder().encode(source.original_text).length;
      else {
        const info = await db.storage
          .from("case-sources")
          .info(source.storage_path);
        check(info.error);
        size = Number(info.data?.size);
        if (!Number.isSafeInteger(size))
          throw new Error(`Could not determine original size for ${source.id}`);
      }
      check(
        (
          await db
            .from("source_documents")
            .update({ byte_size: size })
            .eq("id", source.id)
        ).error,
      );
      count++;
    }
    const owner = source.cases as unknown as {
      is_seed: boolean;
      session_id: string;
      demo_sessions: { expires_at: string } | null;
    };
    if (
      !embed ||
      source.status !== "ready" ||
      source.indexing_status === "ready"
    )
      continue;
    if (
      !owner.is_seed &&
      (!owner.demo_sessions ||
        Date.parse(owner.demo_sessions.expires_at) <= Date.now())
    )
      continue;
    let status = source.indexing_status;
    for (let attempt = 0; attempt < 1000 && status !== "ready"; attempt++) {
      await processSource(
        source.id,
        owner.is_seed ? null : owner.session_id,
        attempt === 0,
      );
      const progress = await db
        .from("source_documents")
        .select("indexing_status,indexing_error,processing_token")
        .eq("id", source.id)
        .single();
      check(progress.error);
      status = progress.data?.indexing_status ?? "failed";
      if (status === "failed") {
        console.error(`${source.id}: ${progress.data?.indexing_error}`);
        failed++;
        break;
      }
      if (progress.data?.processing_token)
        throw new Error(
          "Another processor holds this source. Rerun after its lease finishes.",
        );
    }
    if (status === "ready") indexed++;
  }
  cursor = result.data.at(-1)?.id ?? cursor;
}
console.log(
  `Backfilled ${count} original sizes; indexed ${indexed} sources; ${failed} indexing failures. Existing source IDs and chunks were preserved.`,
);
if (failed) process.exitCode = 1;
