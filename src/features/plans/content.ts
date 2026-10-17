import {
  citationHref,
  passageCitation,
  requestCitation,
} from "@/features/citations/types";
import type { Evidence } from "@/features/queries/types";
import { requestInput } from "@/features/queries/validation";
import {
  type GeneratedPlan,
  PLAN_HEADINGS,
  type PlanBrief,
  type ReusePlan,
} from "./types";

export function briefInput(value: unknown, allowEmpty = false): PlanBrief {
  const item = value as Record<string, unknown> | null;
  if (
    !item ||
    typeof item.title !== "string" ||
    !item.title.trim() ||
    item.title.length > 120 ||
    typeof item.questions !== "string" ||
    item.questions.length > 1000
  )
    throw new Error(
      "Enter a title (up to 120 characters) and questions (up to 1,000 characters).",
    );
  const draft = requestInput({
    ...item,
    request:
      allowEmpty && item.request === ""
        ? "Request not specified"
        : item.request,
  });
  return {
    ...draft,
    request: allowEmpty && item.request === "" ? "" : draft.request,
    title: item.title.trim(),
    questions: item.questions.trim(),
  };
}
export function validateGenerated(
  value: unknown,
  evidence: Evidence[],
): GeneratedPlan {
  const plan = value as GeneratedPlan;
  if (
    !plan ||
    !["reuse", "clarification"].includes(plan.kind) ||
    !Array.isArray(plan.sections) ||
    plan.sections.length !== PLAN_HEADINGS.length
  )
    throw new Error("Wren returned an invalid plan. Retry generation.");
  const ids = new Set(evidence.map((e) => e.id));
  for (const [index, section] of plan.sections.entries()) {
    if (
      section.heading !== PLAN_HEADINGS[index] ||
      !Array.isArray(section.items) ||
      !section.items.length ||
      section.items.length > 6
    )
      throw new Error("The plan has missing sections. Retry generation.");
    for (const item of section.items) {
      if (
        !item ||
        !["fact", "inference", "recommendation", "unknown"].includes(
          item.kind,
        ) ||
        typeof item.text !== "string" ||
        !item.text.trim() ||
        item.text.length > 1500 ||
        /\[S\d+\]/i.test(item.text) ||
        !Array.isArray(item.evidence) ||
        item.evidence.length > 6 ||
        item.evidence.some((id) => !ids.has(id)) ||
        (["fact", "inference"].includes(item.kind) && !item.evidence.length) ||
        (plan.kind === "clarification" &&
          (["fact", "inference"].includes(item.kind) || item.evidence.length))
      )
        throw new Error(
          "The plan contains missing or invalid evidence. Retry generation.",
        );
    }
  }
  if (
    plan.kind === "reuse" &&
    !plan.sections.some((section) =>
      section.items.some((item) => item.evidence.length),
    )
  )
    throw new Error(
      "A reuse plan needs supporting evidence. Retry generation.",
    );
  return plan;
}
export function clarificationPlan(): GeneratedPlan {
  const texts = [
    "No suitable historical precedent was found in the allowed cases. This is a clarification draft.",
    "Identify past work with readable sources before deciding what to reuse.",
    "Confirm the new requirements and constraints before choosing adaptations.",
    "Recorded outcomes and relevant lessons have not been established for this request.",
    "Which requirements are essential, what would success look like, and which uncertainties need investigation?",
    "Collect relevant project records, confirm the requirements, and generate a new plan when evidence is available.",
  ];
  return {
    kind: "clarification",
    sections: PLAN_HEADINGS.map((heading, i) => ({
      heading,
      items: [
        {
          kind: i < 5 ? "unknown" : "recommendation",
          text: texts[i],
          evidence: [],
        },
      ],
    })),
  };
}
export function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_[\]<>#])/g, "\\$1");
}
export function generatedMarkdown(plan: GeneratedPlan, evidence: Evidence[]) {
  const labels = {
    fact: "Recorded evidence",
    inference: "Interpretation",
    recommendation: "Suggested action",
    unknown: "Gap or question",
  };
  return plan.sections
    .map(
      (section) =>
        `## ${section.heading}\n\n${section.items.map((item) => `- **${labels[item.kind]}:** ${escapeMarkdown(item.text)}${item.evidence.map((id) => ` [S${evidence.findIndex((e) => e.id === id) + 1}]`).join(",")}`).join("\n\n")}`,
    )
    .join("\n\n");
}
export function validateMarkdown(markdown: unknown, evidence: Evidence[]) {
  if (
    typeof markdown !== "string" ||
    !markdown.trim() ||
    markdown.length > 50000
  )
    throw new Error("Enter a plan of 1–50,000 characters.");
  if (/^\s*\[\s*S\d+\s*\]\s*:/im.test(markdown))
    throw new Error(
      "Source definitions are managed by Rewoven. Remove the source definition from the editor.",
    );
  for (const match of markdown.matchAll(/\[S(\d+)\]/gi)) {
    const n = Number(match[1]);
    if (
      !evidence[n - 1] ||
      match[0] !== `[S${n}]` ||
      /^\s*(?:\(|:|\[)/.test(
        markdown.slice((match.index ?? 0) + match[0].length),
      )
    )
      throw new Error(
        `Unknown or redefined source marker ${match[0]}. Use the source markers provided with this draft.`,
      );
  }
  return markdown;
}
export function referencedSources(markdown: string, evidence: Evidence[]) {
  const indices = new Set(
    [...markdown.matchAll(/\[S(\d+)\]/g)].map((m) => Number(m[1])),
  );
  return evidence
    .map((item, i) => ({ item, number: i + 1 }))
    .filter((e) => indices.has(e.number));
}
export function sourceDefinitions(evidence: Evidence[], origin = "") {
  return evidence
    .map(
      (item, index) =>
        `[S${index + 1}]: ${origin}${citationHref(passageCitation(item))}`,
    )
    .join("\n");
}
export function exportMarkdown(plan: ReusePlan, origin: string) {
  if (plan.saved_markdown === null || !plan.saved_at || !plan.confirmed_request)
    throw new Error("Save this plan before exporting.");
  const brief = plan.confirmed_request;
  const refs = referencedSources(plan.saved_markdown, plan.evidence);
  const requestSources = (
    plan.request_evidence ??
    plan.snapshot.requestDocuments?.evidence ??
    []
  )
    .map(
      (item, index) => `### R${index + 1}: ${escapeMarkdown(item.title)}

Request document, version ${item.version}${item.page ? `, physical page ${item.page}` : ""}. Describes proposed work.

${item.text
  .split("\n")
  .map((line) => `> ${escapeMarkdown(line)}`)
  .join("\n")}

[Open request document](${origin}${citationHref(requestCitation(item))})`,
    )
    .join("\n\n");
  return `# ${escapeMarkdown(plan.saved_title ?? plan.title)}\n\n${plan.kind === "clarification" ? "Clarification draft — no suitable precedent found." : "Reuse plan — draft for human review."}\n\nUser-edited content is not automatically reverified against its sources.\n\n## Confirmed request\n\n${escapeMarkdown(brief.request)}\n\n${(
    ["deadline", "technology", "capabilities", "questions"] as const
  )
    .filter((k) => brief[k])
    .map((k) => `- **${k}:** ${escapeMarkdown(brief[k])}`)
    .join(
      "\n",
    )}\n\n${plan.saved_markdown}\n\n## Coverage and access\n\n${[...plan.snapshot.warnings, ...plan.warnings].map((w) => `- ${escapeMarkdown(w)}`).join("\n")}\n\nSource links require the original active demo session. Included excerpts remain readable after the session expires.\n\n## Sources\n\n${refs
    .map(
      ({ item, number }) =>
        `### S${number}: ${escapeMarkdown(item.source_title)}\n\nCase: ${escapeMarkdown(item.title)}. Version ${item.version}.${item.page_number ? ` Physical page ${item.page_number}.` : " Text source."}${item.stale ? " Saved reference: source changed or is unavailable." : ""}\n\n${item.text
          .split("\n")
          .map((line) => `> ${escapeMarkdown(line)}`)
          .join(
            "\n",
          )}\n\n[Open source S${number}](${origin}${citationHref(passageCitation(item))})`,
    )
    .join(
      "\n\n",
    )}\n\n${sourceDefinitions(plan.evidence, origin)}\n${requestSources ? `\n## Request document references\n\n${requestSources}\n` : ""}`;
}
