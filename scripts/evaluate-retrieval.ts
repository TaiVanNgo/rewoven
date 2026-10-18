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
    "Purchase requests with manager approval bound to a specific revision and a stale-screen conflict.",
    "Office Purchasing Pilot",
  ],
  [
    "Lost-response retries must return one expense claim using a stable operation key and a database unique constraint.",
    "Expense Reimbursement Portal",
  ],
  [
    "Collect supplier documents, complete versioned checklists and distinguish directory acceptance from spending authority.",
    "Supplier Onboarding Workspace",
  ],
  [
    "Invoice matches used ambiguous supplier names and reused references; the pilot stopped and staff used manual fallback.",
    "Invoice Matching Pilot",
  ],
  [
    "Reject cross-branch direct links and forged branch identifiers while allowing an explicitly assigned central reviewer.",
    "Branch Inventory Request Portal",
  ],
  [
    "Export authorized event history with actor, timestamp, revision, cutoff and safe CSV cells.",
    "Audit Export Dashboard",
  ],
  [
    "Temporary manager delegation for leave requests must expire and preserve the actual acting reviewer.",
    "Staff Leave Approval Tool",
  ],
  [
    "Editable marketing drafts, comments and publication scheduling use lightweight editorial review markers.",
    "Marketing Content Approval Tool",
  ],
  [
    "Unimplemented purchasing expansion proposed finance routing but had unresolved policy questions and no executed acceptance tests.",
    "Purchasing Expansion Proposal",
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
