import { checkDatabase, database } from "@/features/cases/server/db";
import { ApiError, apiError } from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { ownedQueryFile } from "@/features/query-files/server/repository";
export async function GET(
  request: Request,
  context: RouteContext<"/api/query-files/[id]/original">,
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const file = await ownedQueryFile(id, session.id);
    const version = new URL(request.url).searchParams.get("version");
    if (version !== null && version !== String(file.version))
      throw new ApiError(409, "Saved document version is unavailable.");
    const signed = await database()
      .storage.from("query-files")
      .createSignedUrl(
        file.storage_path,
        60,
        file.format === "pdf" ? {} : { download: file.title },
      );
    checkDatabase(signed.error);
    if (!signed.data)
      throw new ApiError(404, "Original request document is unavailable.");
    return new Response(null, {
      status: 302,
      headers: {
        Location: signed.data.signedUrl,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
