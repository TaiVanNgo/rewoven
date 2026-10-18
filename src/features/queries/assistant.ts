import type { ChatContext, Evidence } from "./types";
import { QueryInputError } from "./validation";

export function chatContextInput(value: unknown): ChatContext {
  const item = value as Partial<ChatContext> | null;
  if (
    !item ||
    !["library", "selected", "samples"].includes(String(item.mode)) ||
    !Array.isArray(item.caseIds) ||
    item.caseIds.length > 5 ||
    item.caseIds.some(
      (id) =>
        typeof id !== "string" ||
        !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id),
    ) ||
    new Set(item.caseIds.map((id) => id.toLowerCase())).size !==
      item.caseIds.length ||
    (item.mode !== "selected"
      ? item.caseIds.length !== 0
      : item.caseIds.length === 0)
  )
    throw new QueryInputError(
      "Choose up to five cases, your uploaded library, or the demo library.",
    );
  return {
    mode: item.mode as ChatContext["mode"],
    caseIds: item.caseIds.map((id) => id.toLowerCase()),
  };
}

export type AssistantPlan = {
  intent: "conversation" | "clarify" | "search" | "create_case";
  queries: string[];
  caseIds: string[];
  reply: string;
};
export function assistantPlanInput(
  value: unknown,
  allowedIds: string[],
): AssistantPlan {
  const item = value as AssistantPlan;
  if (
    !item ||
    !["conversation", "clarify", "search", "create_case"].includes(
      item.intent,
    ) ||
    !Array.isArray(item.queries) ||
    item.queries.length > 2 ||
    item.queries.some(
      (q) => typeof q !== "string" || !q.trim() || q.length > 10000,
    ) ||
    !Array.isArray(item.caseIds) ||
    item.caseIds.length > 5 ||
    item.caseIds.some((id) => !allowedIds.includes(id)) ||
    typeof item.reply !== "string" ||
    item.reply.length > 2000 ||
    (item.intent === "search" && !item.queries.length) ||
    (item.intent !== "search" && !item.reply.trim())
  )
    throw new QueryInputError(
      "Wren could not interpret this message. Try rephrasing it.",
    );
  return item;
}

// Interleave per-case queues so one large document cannot crowd out a comparison.
export function evidenceBudget(
  passages: Evidence[],
  maxPassages = 30,
  maxCharacters = 60000,
) {
  const queues = new Map<string, Evidence[]>();
  const seen = new Set<string>();
  for (const item of passages) {
    if (seen.has(item.chunk_id)) continue;
    seen.add(item.chunk_id);
    const queue = queues.get(item.case_id) ?? [];
    queue.push(item);
    queues.set(item.case_id, queue);
  }
  const result: Evidence[] = [];
  let characters = 0;
  for (;;) {
    let added = false;
    for (const queue of queues.values()) {
      const item = queue.shift();
      if (!item) continue;
      added = true;
      if (
        result.length < maxPassages &&
        characters + item.text.length <= maxCharacters
      ) {
        characters += item.text.length;
        result.push({ ...item, id: `e${result.length + 1}` });
      }
    }
    if (!added || result.length >= maxPassages) break;
  }
  return result;
}
