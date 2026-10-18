import { cleanupDeletedCases } from "../src/features/cases/server/deletion";

const target = new URL(process.env.SUPABASE_URL ?? "");
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
    "Hosted cleanup requires --project-ref=<configured project reference> matching SUPABASE_URL.",
  );

let attempted = 0;
let failed = 0;
for (;;) {
  const batch = await cleanupDeletedCases(null);
  attempted += batch.attempted;
  failed += batch.failed;
  if (batch.attempted < 20) break;
}
console.log(
  `Swept ${attempted} deleted cases; ${failed} file-cleanup failures. Final sweeps run only when due; rerun after the signed-upload window.`,
);
if (failed) process.exitCode = 1;
