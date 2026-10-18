import type { QueryConversation, QueryFocus, QueryTurn } from "./types";
import { QueryInputError } from "./validation";

export type QueryPlan = {
  query: string;
  caseId: string | null;
  related: boolean;
  clarification: string;
  candidates: string[];
};
export function validatePlan(
  value: unknown,
  catalog: { id: string; title: string }[],
  focus: QueryFocus,
): QueryPlan {
  if (!value || typeof value !== "object")
    throw new QueryInputError(
      "Wren could not interpret this question. Retry or select a case.",
    );
  const item = value as Record<string, unknown>;
  const ids = new Set(catalog.map((record) => record.id));
  if (
    typeof item.query !== "string" ||
    !item.query.trim() ||
    item.query.length > 10000 ||
    (item.caseId !== null &&
      (typeof item.caseId !== "string" || !ids.has(item.caseId))) ||
    typeof item.related !== "boolean" ||
    typeof item.clarification !== "string" ||
    item.clarification.length > 1000 ||
    !Array.isArray(item.candidates) ||
    item.candidates.length > 6 ||
    item.candidates.some((id) => typeof id !== "string" || !ids.has(id))
  )
    throw new QueryInputError(
      "Wren returned an invalid case reference. Select a case or retry.",
    );
  return {
    query: item.query.trim(),
    caseId: focus.caseId ?? item.caseId,
    related: focus.scope === "related" || item.related,
    clarification: item.clarification,
    candidates: item.candidates as string[],
  };
}
export function namedCases(
  message: string,
  catalog: { id: string; title: string }[],
) {
  const normalize = (text: string) =>
    text.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
  const question = normalize(message);
  return catalog.filter((record) => question.includes(normalize(record.title)));
}
export function conversationContext(
  conversation: QueryConversation,
  turn: QueryTurn,
) {
  const prior = conversation.turns.filter(
    (item) => item.ordinal < turn.ordinal,
  );
  const history: {
    question: string;
    answer: unknown;
    focus: QueryFocus | null;
  }[] = [];
  let characters = 0;
  for (const item of prior.slice(-8).reverse()) {
    const entry = {
      question: item.message,
      // Citation IDs are local to one retrieval bundle. Repeating them in
      // history makes e3 from an earlier answer look like today's e3 even
      // when the source has changed. Keep prose for conversational references.
      answer:
        item.answer?.sections.map(({ heading, text }) => ({ heading, text })) ??
        [],
      focus: item.work?.focus ?? null,
    };
    const size = JSON.stringify(entry).length;
    if (characters + size > 24000) break;
    history.unshift(entry);
    characters += size;
  }
  return {
    originalRequest: conversation.request,
    question: turn.message,
    history,
    warnings:
      history.length < prior.length
        ? [
            "Older conversation context was excluded from this answer. Restate older details if they matter.",
          ]
        : [],
  };
}
