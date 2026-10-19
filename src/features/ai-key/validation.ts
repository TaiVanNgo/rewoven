export const OPENAI_KEY_HEADER = "x-rewoven-openai-key";

export function validPersonalKey(value: string) {
  return /^sk-[A-Za-z0-9_-]{20,509}$/.test(value);
}

// Only these same-origin POST endpoints can make billable AI calls.
export function isAIPath(path: string) {
  return /^\/api\/(?:cases(?:\/analyze|\/[^/]+\/(?:read|retry))?|sources\/[^/]+\/process|retrieval|queries\/[^/]+\/(?:turns|plans)|plans\/[^/]+\/generate|query-files\/[^/]+\/process)$/.test(
    path,
  );
}
