import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { queryModel } from "../src/features/queries/server/openai";
import { processAssistantTurn } from "../src/features/queries/server/process-assistant";
import { createQuery } from "../src/features/queries/server/repository";
import { loadSampleCatalog } from "./sample-catalog";
import { seedTarget } from "./seed-target";

if (!process.argv.includes("--live"))
  throw new Error(
    "Pass --live to acknowledge billable Wren and embedding requests. Local Supabase only.",
  );
const { url, secret } = seedTarget(false);
const db = createClient(url, secret, { auth: { persistSession: false } });
const catalog = await loadSampleCatalog();
const examples = [
  [
    "Office Purchasing Pilot",
    "Explain its architecture and the transaction when a manager approval races an amendment. Include a small Mermaid architecture diagram and an illustrative SQL or TypeScript snippet.",
    [/revision/i, /transaction|lock/i, /conflict|stale/i],
  ],
  [
    "Expense Reimbursement Portal",
    "Explain how concurrent retries and a lost response after commit return the original claim. Include a sequence diagram, the unique key and illustrative SQL; explain a changed payload under the same key.",
    [/operation|idempotenc/i, /unique|constraint/i, /fingerprint|payload/i],
  ],
  [
    "Supplier Onboarding Workspace",
    "Explain private document upload completion, version-bound checklist review, replacement invalidation and a failed completion retry. Show the component architecture.",
    [/version/i, /check|review/i, /private|upload/i],
  ],
  [
    "Invoice Matching Pilot",
    "Explain the actual failed matching pipeline and manual fallback, then separately explain the proposed replacement and its unresolved rules. Was the replacement implemented?",
    [
      /manual|fallback/i,
      /propos|not implemented|never implemented/i,
      /supplier|reference/i,
    ],
  ],
  [
    "Branch Inventory Request Portal",
    "Explain server authorization for a forged branch ID, a direct link and an assignment revoked after a screen opens. Show the important checks and a small architecture diagram.",
    [/branch/i, /server|assignment/i, /revok|revocation/i],
  ],
  [
    "Audit Export Dashboard",
    "Explain the consistent export design. Why is a timestamp cutoff alone insufficient for a late-committing transaction, and how are hostile spreadsheet cells handled?",
    [
      /snapshot|repeatable read/i,
      /cutoff|timestamp/i,
      /formula|spreadsheet|apostrophe/i,
    ],
  ],
  [
    "Staff Leave Approval Tool",
    "Explain the delegation schema and the exact expiry boundary, revocation race and actual actor versus principal. Include an illustrative decision flow.",
    [/delegat/i, /expir/i, /actor|principal/i],
  ],
  [
    "Marketing Content Approval Tool",
    "Explain mutable draft review and notification dispatch architecture, including a crash after provider acceptance. Does an outbox row guarantee exactly-once email or purchasing authority?",
    [
      /draft|editorial/i,
      /notification|outbox/i,
      /crash|duplicate|exactly.once/i,
    ],
  ],
  [
    "Purchasing Expansion Proposal",
    "Explain the proposed policy-version and ordered-stage design, in-flight policy alternatives and missing decisions. Clearly distinguish proposal, hypothetical traces and executed results.",
    [
      /polic/i,
      /propos/i,
      /not implemented|never implemented|no implementation|no.*execut|not.*execut/i,
    ],
  ],
] as const;
type Check = {
  label: string;
  question: string;
  expected: readonly string[];
  terms: readonly RegExp[];
};
const checks: Check[] = examples.map(([title, question, terms]) => ({
  label: title,
  question: `For ${title}: ${question}`,
  expected: [title],
  terms,
}));
checks.push(
  {
    label: "Northbank cross-case design",
    question:
      "Northbank needs purchasing for three branches. Every request needs manager approval; tax-inclusive VND 10,000,000 or more then needs a different finance actor. Edits restart manager review, retrying Send must not duplicate a request, and server checks must enforce current branch assignments. Recommend a cited architecture using delivered precedent, proposed adaptations and open questions. Include a small diagram.",
    expected: [
      "Office Purchasing Pilot",
      "Expense Reimbursement Portal",
      "Branch Inventory Request Portal",
    ],
    terms: [
      /10[,. ]?000[,. ]?000|10 million/i,
      /revision/i,
      /retr|operation|idempoten/i,
    ],
  },
  {
    label: "Tempting editorial mismatch",
    question:
      "Can the Marketing Content Approval Tool be reused unchanged to authorize a purchase amount after edits? Explain precisely which data-model guarantees are missing.",
    expected: ["Marketing Content Approval Tool"],
    terms: [
      /revision|mutable/i,
      /financ|spend|purchas/i,
      /not|cannot|no|missing/i,
    ],
  },
  {
    label: "Unsupported quantum request",
    question:
      "What implemented quantum gate error-correction architecture and measured qubit error rates do our past projects provide?",
    expected: [],
    terms: [/no |not |couldn.t|don.t|unrelated|outside|lack/i],
  },
);
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
const selected = only ? checks.filter((check) => check.label === only) : checks;
if (!selected.length) throw new Error("Unknown evaluation scenario.");
const session = await db
  .from("demo_sessions")
  .insert({ token_hash: randomUUID() })
  .select("id")
  .single();
if (session.error || !session.data)
  throw new Error("Could not create local evaluation session.");
const results = [];
try {
  for (const check of selected) {
    let rawAnswer: unknown = null;
    const decisions: unknown[] = [];
    const query = await createQuery(
      { requestKey: randomUUID(), request: check.question, assistant: true },
      session.data.id,
    );
    const completed = await processAssistantTurn(
      query.id,
      {
        requestKey: randomUUID(),
        message: check.question,
        contextRevision: 0,
      },
      session.data.id,
      {
        model: async (kind, input, config) => {
          const response = await queryModel(kind, input, config);
          if (kind === "assistant_answer") rawAnswer = response;
          else decisions.push({ kind, response });
          return response;
        },
      },
    );
    const turn = completed.turns.at(-1);
    const text = turn?.answer?.sections.map((s) => s.text).join("\n\n") ?? "";
    const cited = new Set(
      turn?.answer?.sections.flatMap((s) => s.evidence) ?? [],
    );
    const titles = [
      ...new Set(
        turn?.work?.evidence.filter((e) => cited.has(e.id)).map((e) => e.title),
      ),
    ];
    const issues = [];
    if (turn?.status !== "ready")
      issues.push(turn?.error_message ?? "Turn not Ready");
    for (const title of check.expected)
      if (!titles.includes(title)) issues.push(`Missing cited case: ${title}`);
    for (const term of check.terms)
      if (!term.test(text))
        issues.push(`Missing explanation signal: ${term.source}`);
    if (/diagram/i.test(check.question) && !/```mermaid\b/.test(text))
      issues.push("Requested diagram missing");
    if (/\be\d+\b/.test(text))
      issues.push("Raw evidence IDs leaked into prose");
    if (
      check.label === "Northbank cross-case design" &&
      turn?.answer?.sections.some(
        (s) =>
          ["unknown", "recommendation"].includes(s.kind) &&
          /(?:confirm|clarify|decide|whether|should)[^.!?\n]{0,100}(?:threshold|tax-inclusive|same person|different actor)/i.test(
            s.text,
          ),
      )
    )
      issues.push("An explicitly supplied Northbank rule was reopened");
    if (
      !check.expected.length &&
      turn?.answer?.sections.some((s) => s.kind === "fact")
    )
      issues.push("Unsupported request produced historical facts");
    if (
      turn?.work?.evidence.some((e) => !catalog.some((c) => c.id === e.case_id))
    )
      issues.push("Evidence escaped active catalog");
    results.push({
      label: check.label,
      pass: !issues.length,
      issues,
      citedCases: titles,
      query: completed,
      rawAnswer,
      decisions,
    });
    console.log(
      `${issues.length ? "FAIL" : "PASS"}: ${check.label}${issues.length ? ` — ${issues.join("; ")}` : ""}`,
    );
  }
} finally {
  const cleaned = await db
    .from("demo_sessions")
    .delete()
    .eq("id", session.data.id);
  if (cleaned.error) {
    console.error(
      "Could not remove evaluation session:",
      cleaned.error.message,
    );
    process.exitCode = 1;
  }
  await mkdir("output/playwright", { recursive: true });
  await writeFile(
    `output/playwright/wren-engineering-live${only ? `-${only.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}.json`,
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        caveat:
          "Explanation signals and citation membership are automated checks, not proof of claim entailment. Manually inspect answers and cited excerpts.",
        results,
      },
      null,
      2,
    ),
  );
}
console.log(
  `${results.filter((r) => r.pass).length}/${selected.length} Wren engineering scenarios passed automated checks. Inspect output/playwright/wren-engineering-live*.json for claim support.`,
);
if (results.length !== selected.length || results.some((r) => !r.pass))
  process.exitCode = 1;
