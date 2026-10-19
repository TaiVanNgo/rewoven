import { createHash, randomBytes, randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { seedTarget } from "../scripts/seed-target";
import { generatedMarkdown } from "../src/features/plans/content";
import { registrationPlan } from "./fixtures/reuse-plan";

const { url, secret } = seedTarget(false);
const db = createClient(url, secret);
const file =
  process.env.PLAN_BROWSER_FIXTURE ?? "/tmp/rewoven-plan-browser-fixture.json";
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.SUPABASE_URL ?? "").hostname,
  )
)
  throw new Error("Browser fixtures must use local Supabase.");
if (process.argv.includes("--generate")) {
  const fixture = await Bun.file(file).json();
  const result = await db
    .from("reuse_plans")
    .select("*")
    .eq("id", fixture.planId)
    .single();
  if (result.error) throw result.error;
  const { evidence, generated, generated_markdown, confirmed_request } =
    result.data;
  const updated = await db
    .from("reuse_plans")
    .update({
      evidence,
      generated,
      generated_markdown,
      confirmed_request,
      title: confirmed_request.title,
      status: "ready",
      failed_stage: null,
      error_message: null,
    })
    .eq("id", fixture.reviewId);
  if (updated.error) throw updated.error;
  process.exit(0);
}
if (process.argv.includes("--cleanup")) {
  const fixture = await Bun.file(file).json();
  const r = await db.from("demo_sessions").delete().eq("id", fixture.sessionId);
  if (r.error) throw r.error;
  unlinkSync(file);
  process.exit(0);
}
const token = randomBytes(32).toString("hex"),
  sessionId = randomUUID(),
  queryId = randomUUID(),
  caseId = randomUUID(),
  sourceId = randomUUID(),
  chunkId = randomUUID(),
  planId = randomUUID(),
  legacyId = randomUUID(),
  reviewId = randomUUID(),
  turnId = randomUUID();
async function insert(table: string, data: Record<string, unknown>) {
  const r = await db.from(table).insert(data);
  if (r.error) throw r.error;
}
const brief = {
  title: "Registration reuse plan",
  request: "Build a concurrent registration workflow with audit history.",
  deadline: "Next month",
  technology: "PostgreSQL",
  capabilities: "Seat reservations and confirmations",
  questions: "How long should a seat reservation last?",
};
const context = { mode: "selected", caseIds: [caseId] };
const text =
  "The fictional registration pilot used transaction-enforced seat leases. The journal records a duplicate confirmation issue. The final outcome was not recorded.";
await insert("demo_sessions", {
  id: sessionId,
  token_hash: createHash("sha256").update(token).digest("hex"),
});
await insert("cases", {
  id: caseId,
  session_id: sessionId,
  request_key: caseId,
  title: "Fictional registration pilot",
  status: "ready",
});
await insert("source_documents", {
  id: sourceId,
  case_id: caseId,
  title: "pilot-journal.md",
  format: "md",
  original_text: text,
  extracted_text: text,
  status: "ready",
  indexing_status: "ready",
});
await insert("source_chunks", {
  id: chunkId,
  source_id: sourceId,
  ordinal: 0,
  char_start: 0,
  char_end: text.length,
  text,
});
await insert("query_conversations", {
  id: queryId,
  session_id: sessionId,
  title: brief.title,
  request: brief,
  assistant: true,
  chat_context: context,
});
await insert("query_turns", {
  id: turnId,
  conversation_id: queryId,
  ordinal: 1,
  message: brief.request,
  scope: "library",
  status: "ready",
  answer: {
    sections: [
      {
        kind: "conversation",
        heading: "",
        text: "Review the registration request and its historical evidence.",
        evidence: [],
      },
    ],
  },
});
const evidence = [
  {
    id: "e1",
    chunk_id: chunkId,
    source_id: sourceId,
    case_id: caseId,
    title: "Fictional registration pilot",
    source_title: "pilot-journal.md",
    version: 1,
    page_number: null,
    char_start: 0,
    char_end: text.length,
    text,
    outcome: "",
    score: 1,
  },
];
const snapshot = {
  context,
  originalRequest: brief,
  messages: [brief.request],
  throughTurnId: turnId,
  warnings: [],
};
const legacyMarkdown =
  "## Relevant precedent and important differences\n\n- **Recorded evidence:** The fictional pilot used transaction-enforced seat leases; its outcome was not recorded. [S1]\n\n## What to reuse\n\n- **Suggested action:** Evaluate transaction-enforced seat reservations. [S1]\n\n## Required adaptations\n\n- **Suggested action:** Confirm the required reservation duration.\n\n## Lessons and risks\n\n- **Recorded evidence:** The journal records a duplicate confirmation issue. [S1]\n\n## Clarification questions\n\n- What capacity and reservation duration are required?\n\n## Suggested next steps\n\n- Review the proposed concurrency behavior with the project lead.";
const generated = registrationPlan();
const markdown = generatedMarkdown(generated, evidence);
await insert("reuse_plans", {
  id: planId,
  session_id: sessionId,
  conversation_id: queryId,
  title: brief.title,
  snapshot,
  brief,
  confirmed_request: brief,
  status: "ready",
  evidence,
  generated,
  generated_markdown: markdown,
});
await insert("reuse_plans", {
  id: legacyId,
  session_id: sessionId,
  conversation_id: queryId,
  title: "Legacy registration plan",
  snapshot,
  brief,
  confirmed_request: brief,
  status: "ready",
  evidence,
  generated_markdown: legacyMarkdown,
  saved_markdown: legacyMarkdown,
  saved_title: "Legacy registration plan",
  saved_at: new Date().toISOString(),
});
const reviewFailed = process.env.PLAN_BROWSER_START_FAILED === "true";
await insert("reuse_plans", {
  id: reviewId,
  session_id: sessionId,
  conversation_id: queryId,
  title: "Review request",
  snapshot,
  brief,
  status: reviewFailed ? "failed" : "review",
  ...(reviewFailed
    ? {
        failed_stage: "generate",
        error_message: "The plan has missing sections. Retry generation.",
        confirmed_request: brief,
      }
    : {}),
});
writeFileSync(
  file,
  JSON.stringify({
    token,
    sessionId,
    queryId,
    planId,
    reviewId,
    reviewFailed,
    legacyId,
    legacyMarkdown,
  }),
  { mode: 0o600 },
);
console.log("Browser fixture prepared.");
