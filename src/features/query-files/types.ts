import type { SourcePage } from "@/features/cases/types";

export const FILE_ONLY_MESSAGE =
  "Analyze the uploaded problem and compare it with relevant past cases.";
export const MAX_MESSAGE_FILES = 5;
export type RequestFinding = {
  kind: "requirement" | "constraint" | "question";
  text: string;
  evidence: string[];
};
export type RequestNode = { level: number; findings: RequestFinding[] };
export type QueryFile = {
  id: string;
  conversation_id: string;
  title: string;
  format: "txt" | "md" | "pdf";
  version: number;
  byte_size: number;
  char_count: number;
  status: "uploading" | "extracting" | "reading" | "ready" | "failed";
  enabled: boolean;
  first_turn_id: string | null;
  warnings: string[];
  error_message: string | null;
  cursor: number;
  total: number;
};
export type StoredQueryFile = QueryFile & {
  session_id: string;
  storage_path: string;
  pages: SourcePage[];
  nodes: RequestNode[];
  processing_token: string | null;
};
export type RequestEvidence = {
  id: string;
  documentId: string;
  conversationId: string;
  title: string;
  version: number;
  page: number | null;
  start: number;
  end: number;
  text: string;
};
export type RequestDocumentContext = {
  documents: {
    id: string;
    title: string;
    version: number;
    findings: RequestFinding[];
  }[];
  evidence: RequestEvidence[];
};
export type FileManifest = { id: string; title: string; size: number };
