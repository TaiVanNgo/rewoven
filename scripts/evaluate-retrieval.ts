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
    "Employees submit expense claims for one supervisor to approve, with a decision audit trail.",
    "Expense Approval Portal",
  ],
  [
    "A client must complete legal checks before we activate their account. Each onboarding task needs an assigned role.",
    "Client Onboarding Checklist",
  ],
  [
    "Find internal help articles using labels and inspect their revision history.",
    "Support Knowledge Base",
  ],
  [
    "A purchase request goes through manager then finance; a rejection requires a reason and resubmission restarts review.",
    "Purchase Workflow Notes",
  ],
  [
    "Compare warehouse stock against shipments each night and put discrepancies into a human review queue.",
    "Inventory Reconciliation",
  ],
  [
    "Reserve staff and rooms for calendar appointments without exceeding capacity, and test daylight saving changes.",
    "Appointment Scheduling",
  ],
  [
    "Suppliers submit invoices. Finance should detect duplicate vendor IDs and invoice numbers before paying.",
    "Vendor Billing Portal",
  ],
  [
    "Help the next support shift see the current incident impact, attempted actions, and owner of unfinished work.",
    "Incident Handoff Log",
  ],
  [
    "Preview CSV rows, validate email addresses before writing data, show per-row errors, and prevent duplicate batch imports.",
    "Customer Import Tool",
  ],
  [
    "Deploy a new release only after approval and smoke tests, keeping a rollback command for failures.",
    "Release Checklist",
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
    `Expected case in top three: ${hits}/10; unrelated requests with no results: ${negatives}/2.`,
  );
  if (hits < 8 || negatives !== 2) process.exitCode = 1;
} finally {
  await db.from("demo_sessions").delete().eq("id", session.data.id);
}
