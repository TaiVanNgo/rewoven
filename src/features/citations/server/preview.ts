import "server-only";
import { database } from "@/features/cases/server/db";
import { ApiError } from "@/features/cases/server/http";
import { ownedSource } from "@/features/cases/server/sources";
import type { SourcePage } from "@/features/cases/types";
import { sourceContext, sourceLocation } from "../source-context";
import type { SourcePreview } from "../types";

export async function sourcePreview(
  id: string,
  sessionId: string,
  query: URLSearchParams,
): Promise<SourcePreview> {
  const location = sourceLocation(query);
  const source = await ownedSource(id, sessionId);
  if (location.version !== null && location.version !== source.version)
    throw new ApiError(
      409,
      "This source version is unavailable. The saved quote has not been replaced.",
    );
  const pages = source.pages as SourcePage[];
  const pageCount = source.page_count || pages.length || 1;
  if (location.page > pageCount)
    throw new ApiError(400, "This source page is unavailable.");
  const page = pages.find((p) => p.number === location.page);
  const context = sourceContext(page?.text ?? "", location);
  let pdfUrl: string | null = null;
  if (source.format === "pdf" && source.storage_path) {
    const signed = await database()
      .storage.from("case-sources")
      .createSignedUrl(source.storage_path, 60);
    pdfUrl = signed.data?.signedUrl ?? null;
  }
  return {
    source: {
      id: source.id,
      title: source.title,
      format: source.format,
      version: source.version,
      pageCount,
    },
    page: location.page,
    ...context,
    pdfUrl,
  };
}
