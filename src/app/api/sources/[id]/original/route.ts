import { checkDatabase, database } from "@/features/cases/server/db";
import { ApiError, apiError, validId } from "@/features/cases/server/http";
import { accessibleCase } from "@/features/cases/server/repository";
import { requireSession } from "@/features/cases/server/session";
import {
  SourceLocationError,
  sourceLocation,
} from "@/features/citations/source-context";
export async function GET(
  request: Request,
  context: RouteContext<"/api/sources/[id]/original">,
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const db = database();
    const source = await db
      .from("source_documents")
      .select("case_id,title,format,version,original_text,storage_path")
      .eq("id", validId(id))
      .maybeSingle();
    checkDatabase(source.error);
    if (!source.data) throw new ApiError(404, "Source not found.");
    await accessibleCase(source.data.case_id, session.id);
    const { version } = sourceLocation(new URL(request.url).searchParams);
    if (version !== null && source.data.version !== version)
      throw new ApiError(
        409,
        "This source version is unavailable. The reference has not been replaced.",
      );
    const data = source.data;
    const headers = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type":
        data.format === "pdf" ? "application/pdf" : "text/plain; charset=utf-8",
      "Content-Disposition": `${data.format === "pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(data.title).replace(/'/g, "%27")}`,
    };
    if (data.original_text !== null)
      return new Response(data.original_text, { headers });
    const signed = await db.storage
      .from("case-sources")
      .createSignedUrl(
        data.storage_path,
        60,
        data.format === "pdf" ? {} : { download: data.title },
      );
    if (signed.error || !signed.data)
      throw new ApiError(
        404,
        "The original file is unavailable. Select the original again to resume.",
      );
    return new Response(null, {
      status: 302,
      headers: {
        Location: signed.data.signedUrl,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof SourceLocationError)
      return new Response(error.message, {
        status: 400,
        headers: { "Cache-Control": "private, no-store" },
      });
    return apiError(error);
  }
}
