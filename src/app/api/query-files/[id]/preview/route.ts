import { apiError, json } from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { SourceLocationError } from "@/features/citations/source-context";
import { queryFilePreview } from "@/features/query-files/server/repository";
export async function GET(
  request: Request,
  context: RouteContext<"/api/query-files/[id]/preview">,
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return json(
      await queryFilePreview(id, session.id, new URL(request.url).searchParams),
    );
  } catch (error) {
    return error instanceof SourceLocationError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
}
