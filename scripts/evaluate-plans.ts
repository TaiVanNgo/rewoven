import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generatedMarkdown,
  validateGenerated,
} from "../src/features/plans/content";
import {
  queryAIConfig,
  queryModel,
} from "../src/features/queries/server/openai";
import type { Evidence } from "../src/features/queries/types";

if (!process.argv.includes("--live"))
  throw new Error(
    "Pass --live to acknowledge one billable OpenAI plan-generation call. No database records are changed.",
  );

const config = queryAIConfig();
if (!config)
  throw new Error("Configure OPENAI_API_KEY for this opt-in evaluation.");
const root = join(process.cwd(), "output/pdf/rewoven-purchase-demo/upload");
const request = {
  title: "Northbank purchasing pilot",
  request: await readFile(join(root, "Client input/constraints.md"), "utf8"),
  deadline: "Requested four-week pilot; feasibility is unverified.",
  technology:
    "Next.js, PostgreSQL, existing employee sign-in, mobile browsers.",
  capabilities: "Three-branch purchasing request pilot.",
  questions: "Use the unresolved questions in the confirmed request.",
};
const cases = [
  ["01-office-purchasing", "Office Purchasing Pilot"],
  ["02-expense-reimbursement", "Expense Reimbursement Portal"],
  ["05-branch-inventory", "Branch Inventory Request Portal"],
  ["06-audit-export", "Audit Export Dashboard"],
  ["09-purchasing-expansion", "Purchasing Expansion Proposal"],
];
const evidence: Evidence[] = await Promise.all(
  cases.map(async ([folder, title], index) => {
    const source = join("Historical cases", folder, "implementation-notes.md");
    const text = await readFile(join(root, source), "utf8");
    return {
      id: `e${index + 1}`,
      case_id: randomUUID(),
      source_id: randomUUID(),
      chunk_id: randomUUID(),
      title,
      source_title: source,
      version: 1,
      page_number: null,
      char_start: 0,
      char_end: text.length,
      text,
      outcome: "",
      score: 1,
    };
  }),
);
const generated = validateGenerated(
  await queryModel(
    "reuse_plan",
    {
      request,
      requestDocuments: { documents: [], evidence: [] },
      evidence,
      coverageWarnings: [
        "Evaluation supplies selected implementation notes only, not delivery reviews or complete project coverage.",
      ],
    },
    config,
  ),
  evidence,
);
const markdown = generatedMarkdown(generated, evidence);
const directory = await mkdtemp(join(tmpdir(), "rewoven-plan-quality-"));
await writeFile(
  join(directory, "plan.json"),
  JSON.stringify(generated, null, 2),
);
await writeFile(
  join(directory, "plan.md"),
  `${markdown}\n\n## Evaluation source excerpts\n\n${evidence.map((item, index) => `### S${index + 1}: ${item.title} / ${item.source_title}\n\n${item.text}`).join("\n\n")}`,
);
console.log(
  `Validated structured output from ${config.model}. Review sample: ${join(directory, "plan.md")}`,
);
console.log(
  `Approximate plan length: ${markdown.split(/\s+/).filter(Boolean).length} words. Target: 400–650; important constraints take priority.`,
);
console.log(
  "Human review required: clear outcome and first action; observable completion conditions; no repeated questions; all critical Northbank rules/exclusions; citations support the claims; proposals remain proposals and four weeks remains a requested constraint.",
);
console.log(
  "This evaluates writing with fixed evidence only. It does not verify retrieval, request preparation, saved-plan behavior, or deployment quality. App usage counters are not applied to this standalone billable evaluation.",
);
