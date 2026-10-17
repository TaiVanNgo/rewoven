import { caseApi } from "@/features/cases/api-client";
import type { QueryFile } from "./types";

export type PendingQueryUpload = {
  id: string;
  file: File;
  state: string;
  error?: string;
};
export async function prepareQueryFile(
  file: QueryFile,
  update: (file: QueryFile) => void,
  signal?: AbortSignal,
) {
  let current = file;
  if (current.status === "uploading")
    throw new Error(`Upload ${current.title} again, or exclude it.`);
  while (current.status !== "ready") {
    signal?.throwIfAborted();
    const result = await caseApi<{ file: QueryFile }>(
      `/api/query-files/${file.id}/process`,
      {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry: true }),
      },
    );
    current = result.file;
    update(current);
    if (current.status === "failed")
      throw new Error(current.error_message ?? "Could not read this file.");
  }
  if (current.warnings.length)
    throw new Error(
      `${current.title} has unavailable pages. Inspect the warning and exclude this file, or upload a complete text-based document.`,
    );
}
export async function uploadQueryFile(
  item: PendingQueryUpload,
  update: (state: string) => void,
  progress: (file: QueryFile) => void,
  signal?: AbortSignal,
) {
  update("Uploading…");
  const reservation = await caseApi<{ uploadUrl: string | null }>(
    `/api/query-files/${item.id}/upload`,
    { method: "POST", signal },
  );
  if (reservation.uploadUrl) {
    // Completion checks the immutable stored object even after a lost PUT response.
    try {
      const result = await fetch(reservation.uploadUrl, {
        method: "PUT",
        signal,
        headers: {
          "Content-Type": item.file.type || "application/octet-stream",
        },
        body: item.file,
      });
      if (!result.ok && result.status !== 409)
        throw new Error("Upload interrupted.");
    } catch {
      /* The server verifies whether the original arrived below. */
    }
  }
  signal?.throwIfAborted();
  await caseApi(`/api/query-files/${item.id}/complete`, {
    method: "POST",
    signal,
  });
  await prepareQueryFile(
    { id: item.id, status: "extracting" } as QueryFile,
    (file) => {
      progress(file);
      update(
        file.status === "reading"
          ? `Reading ${file.cursor}/${file.total} passages…`
          : file.status === "ready"
            ? "Ready"
            : "Extracting text…",
      );
    },
    signal,
  );
}
