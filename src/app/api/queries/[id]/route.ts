import { apiError, json } from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { queryDetail } from "@/features/queries/server/repository";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/queries/[id]">,
) {
  try {
    return json({
      query: await queryDetail(
        (await context.params).id,
        (await requireSession()).id,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
