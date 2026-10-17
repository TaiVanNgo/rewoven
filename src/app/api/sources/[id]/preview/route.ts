import { apiError, json } from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { sourcePreview } from "@/features/citations/server/preview";
import { SourceLocationError } from "@/features/citations/source-context";

export async function GET(
  request: Request,
  context: RouteContext<"/api/sources/[id]/preview">,
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return json(
      await sourcePreview(id, session.id, new URL(request.url).searchParams),
    );
  } catch (error) {
    return error instanceof SourceLocationError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
}
