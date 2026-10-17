import { apiError, checkOrigin, json } from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { queryFileUpload } from "@/features/query-files/server/repository";
export const maxDuration = 90;
export async function POST(
  request: Request,
  context: RouteContext<"/api/query-files/[id]/upload">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    return json(await queryFileUpload(id, session.id));
  } catch (error) {
    return apiError(error);
  }
}
