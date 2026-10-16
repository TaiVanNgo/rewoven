import { caseApi } from "./api-client";
import type { CaseDetail } from "./types";
export type PendingUpload = {
  key: string;
  file: File;
  state: string;
  sourceId?: string;
  error?: string;
};
export async function uploadSource(
  caseId: string,
  item: PendingUpload,
  analysisId?: string,
) {
  const reservation = await caseApi<{
    sourceId: string;
    uploadUrl: string | null;
  }>(`/api/cases/${caseId}/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestKey: item.key,
      title: item.file.name.slice(0, 200),
      size: item.file.size,
    }),
  });
  if (reservation.uploadUrl) {
    const upload = await fetch(reservation.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": item.file.type || "application/octet-stream" },
      body: item.file,
    });
    // A lost completion response may leave the immutable object already present.
    if (!upload.ok && upload.status !== 409) {
      const completed = await fetch(
        `/api/sources/${reservation.sourceId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisId }),
        },
      );
      if (!completed.ok)
        throw new Error(
          "Upload did not finish. Retry this file; completed documents are kept.",
        );
    }
  }
  await caseApi(`/api/sources/${reservation.sourceId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysisId }),
  });
  return reservation.sourceId;
}
export async function uploadFiles(
  caseId: string,
  items: PendingUpload[],
  onUpdate: (key: string, patch: Partial<PendingUpload>) => void,
  analysisId?: string,
) {
  let cursor = 0;
  let failed = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      if (item.state === "uploaded") continue;
      onUpdate(item.key, { state: "uploading", error: undefined });
      try {
        const sourceId = await uploadSource(caseId, item, analysisId);
        onUpdate(item.key, { state: "uploaded", sourceId });
      } catch (error) {
        failed++;
        onUpdate(item.key, {
          state: "failed",
          error:
            error instanceof Error
              ? error.message
              : "Upload failed. Retry this file.",
        });
      }
    }
  }
  await Promise.all([worker(), worker()]);
  return {
    ...(await caseApi<{ case: CaseDetail }>(`/api/cases/${caseId}`)),
    failed,
  };
}
