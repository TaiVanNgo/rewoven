export const MAX_FILE_BYTES = 5_000_000;
export const MAX_SOURCE_CHARS = 50_000;
export const PROCESSING_LEASE_MS = 120_000;
export type CaseStatus = "processing" | "ready" | "failed";
export type SourceFormat = "text" | "txt" | "md" | "pdf";
export type SourcePage = { number: number; text: string };
export type CaseRecord = {
  id: string;
  is_seed: boolean;
  title: string;
  context: string;
  outcome: string;
  lessons: string;
  status: CaseStatus;
  error_message: string | null;
  processing_started_at: string;
  created_at: string;
};
export type SourceDocument = {
  id: string;
  case_id: string;
  title: string;
  format: SourceFormat;
  version: number;
  extracted_text: string | null;
  pages: SourcePage[];
  warnings: string[];
};
export type CaseSummary = CaseRecord & {
  sources: Pick<SourceDocument, "id" | "title" | "format">[];
};
export type CaseDetail = CaseRecord & { sources: SourceDocument[] };
