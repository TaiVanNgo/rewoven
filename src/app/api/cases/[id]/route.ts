import { apiError, json } from "@/features/cases/server/http";
import { caseDetail } from "@/features/cases/server/repository";
import { requireSession } from "@/features/cases/server/session";
export async function GET(
  _request: Request,
  context: RouteContext<"/api/cases/[id]">,
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return json({ case: await caseDetail(id, session.id) });
  } catch (error) {
    return apiError(error);
  }
}
