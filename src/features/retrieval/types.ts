export type Passage = {
  chunk_id: string;
  source_id: string;
  case_id: string;
  title: string;
  source_title: string;
  version: number;
  page_number: number | null;
  char_start: number;
  char_end: number;
  text: string;
  outcome: string;
  score: number;
};
export type RetrievalResult = {
  cases: { id: string; title: string; outcome: string; passages: Passage[] }[];
  mode: "hybrid" | "keyword";
  warnings: string[];
};
