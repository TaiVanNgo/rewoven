import { apiError, json } from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { sourceText } from "@/features/cases/server/sources";
export async function GET(
  request: Request,
  context: RouteContext<"/api/sources/[id]/text">,
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const query = new URL(request.url).searchParams;
    return json(
      await sourceText(
        id,
        session.id,
        Number(query.get("page") ?? 1),
        Number(query.get("start") ?? 0),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
