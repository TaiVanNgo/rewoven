import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { retrieve } from "../src/features/retrieval/server/retrieve";
import { seedTarget } from "./seed-target";

if (!process.argv.includes("--live"))
  throw new Error(
    "Pass --live to acknowledge billable OpenAI query embeddings. This evaluation targets local Supabase only.",
  );
const { url, secret } = seedTarget(false);
const db = createClient(url, secret, { auth: { persistSession: false } });
const session = await db
  .from("demo_sessions")
  .insert({ token_hash: randomUUID() })
  .select("id")
  .single();
if (session.error || !session.data)
  throw new Error("Could not create evaluation session.");
const examples = [
  [
    "Import delivery manifests, approve run sheets and keep stop amendment history for dispatchers.",
    "Harbor Route Planning Pilot",
  ],
  [
    "Review attendance workbook aliases and versioned payroll category mappings before generating a vendor-format draft.",
    "Cedar Payroll Integration Design Review",
  ],
  [
    "Migrate legacy identities with independent reconciliation and preserve historical author identifiers.",
    "Prism Identity Cutover - Conflicting Closure Records",
  ],
  [
    "Buffer pump telemetry offline, deduplicate repeated sequence uploads and show coverage gaps.",
    "Watershed Pump Telemetry - Offline Pilot Journal",
  ],
  [
    "Reconcile subscription event invoice drafts, block posting on mismatches and retain a billing rollback path.",
    "Redwood Subscription Billing Rollback Report",
  ],
  [
    "Prepare appointment reminders, recheck opt-out preferences and reconcile delivery receipts.",
    "Compass Appointment Reminder Pilot",
  ],
  [
    "Migrate searchable catalog attachments with checksums and human review while treating imported notes as untrusted content.",
    "Lexicon Archive Migration and Untrusted Attachment",
  ],
  [
    "Track donated pantry food with stock movements, explicit units, correction reasons and a paper fallback.",
    "Vườn Nhỏ - Nhật ký thiết kế kho thực phẩm cộng đồng",
  ],
  [
    "Reserve course seats under concurrent requests with transaction-enforced lease expiry and idempotent confirmation.",
    "Summit Course Registration Engineering Journal",
  ],
  [
    "Calculate quantum gate error correction for a superconducting qubit array.",
    null,
  ],
  [
    "Model protein folding from amino acid sequences for molecular drug discovery.",
    null,
  ],
] as const;
let hits = 0,
  negatives = 0;
try {
  for (const [request, expected] of examples) {
    const result = await retrieve({ request }, session.data.id);
    if (result.mode !== "hybrid") throw new Error(result.warnings.join(" "));
    const titles = result.cases.map((c) => c.title);
    const pass = expected ? titles.includes(expected) : titles.length === 0;
    if (expected && pass) hits++;
    if (!expected && pass) negatives++;
    console.log(
      `${pass ? "PASS" : "FAIL"}: ${expected ?? "No precedent"} => ${titles.join(", ") || "no results"}`,
    );
  }
  console.log(
    `Expected case in top three: ${hits}/9; unrelated requests with no results: ${negatives}/2.`,
  );
  if (hits < 8 || negatives !== 2) process.exitCode = 1;
} finally {
  await db.from("demo_sessions").delete().eq("id", session.data.id);
}
