import { checkDatabase, database } from "@/features/cases/server/db";
import { ApiError, apiError, validId } from "@/features/cases/server/http";
import { accessibleCase } from "@/features/cases/server/repository";
import { requireSession } from "@/features/cases/server/session";
export async function GET(
  _request: Request,
  context: RouteContext<"/api/sources/[id]/original">,
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const db = database();
    const source = await db
      .from("source_documents")
      .select("case_id,title,format,original_text,storage_path")
      .eq("id", validId(id))
      .maybeSingle();
    checkDatabase(source.error);
    if (!source.data) throw new ApiError(404, "Source not found.");
    await accessibleCase(source.data.case_id, session.id);
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
    const file = await db.storage
      .from("case-sources")
      .download(data.storage_path);
    if (file.error || !file.data)
      throw new ApiError(
        404,
        "The original file is unavailable. Add the case again with the original source.",
      );
    return new Response(file.data, { headers });
  } catch (error) {
    return apiError(error);
  }
}
