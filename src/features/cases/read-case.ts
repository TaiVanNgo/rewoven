import { caseApi } from "./api-client";
import type { ReadingProgress } from "./case-reading";
import type { CaseDetail } from "./types";

export async function readCaseDocuments(
  caseId: string,
  onProgress: (progress: string) => void,
  onReading: (progress: ReadingProgress) => void,
  stopped: () => boolean,
) {
  const retried = new Set<string>();
  while (!stopped()) {
    const { case: record } = await caseApi<{ case: CaseDetail }>(
      `/api/cases/${caseId}`,
    );
    if (stopped()) break;
    const uploading = record.sources.find(
      (source) => source.status === "uploading",
    );
    if (uploading)
      throw new Error(
        `Upload ${uploading.title} completely before reading this case.`,
      );
    const next = record.sources.find((source) => source.status !== "ready");
    if (!next) break;
    if (next.status === "failed" && retried.has(next.id))
      throw new Error(
        `${next.title}: ${next.error_message ?? "Text extraction failed. Retry the document in Case library."}`,
      );
    if (next.status === "failed") retried.add(next.id);
    onProgress(
      `Preparing ${next.title}${next.page_count ? ` · ${next.extraction_cursor}/${next.page_count} pages` : ""}…`,
    );
    const progress = await caseApi<{
      status: string;
      error_message: string | null;
    }>(`/api/sources/${next.id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retry: next.status === "failed" }),
    });
    if (progress.status === "failed")
      throw new Error(
        `${next.title}: ${progress.error_message ?? "Text extraction failed."}`,
      );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  onProgress("Reading the complete case in saved sections…");
  let readingId: string | undefined;
  while (!stopped()) {
    const progress = await caseApi<ReadingProgress>(
      `/api/cases/${caseId}/read`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingId }),
      },
    );
    readingId = progress.id;
    onReading(progress);
    onProgress(
      progress.phase === "combining"
        ? `Combining supported findings from ${progress.documents} document(s)…`
        : `Reading ${progress.completed}/${progress.total} sections across ${progress.documents} document(s)…`,
    );
    if (progress.status === "ready" && progress.result) return progress.result;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(
    "Reading paused. Uploaded documents and completed AI stages are saved. Open Read case with AI in Case library to resume.",
  );
}
