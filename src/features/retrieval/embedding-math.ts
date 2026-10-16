export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export function meanQueryVector(vectors: number[][], weights: number[]) {
  const result = Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (let i = 0; i < vectors.length; i++)
    for (let j = 0; j < result.length; j++)
      result[j] += vectors[i][j] * weights[i];
  const norm = Math.hypot(...result);
  if (!norm || !Number.isFinite(norm))
    throw new Error("Query embedding is invalid.");
  return result.map((v) => v / norm);
}
export function groupPassages<
  T extends {
    case_id: string;
    title: string;
    outcome: string;
    source_id: string;
    char_start: number;
    page_number: number | null;
  },
>(passages: T[]) {
  const cases = new Map<
    string,
    { id: string; title: string; outcome: string; passages: T[] }
  >();
  for (const passage of passages) {
    if (!cases.has(passage.case_id) && cases.size < 3)
      cases.set(passage.case_id, {
        id: passage.case_id,
        title: passage.title,
        outcome: passage.outcome,
        passages: [],
      });
    const record = cases.get(passage.case_id);
    if (record && record.passages.length < 3) record.passages.push(passage);
  }
  return [...cases.values()];
}
