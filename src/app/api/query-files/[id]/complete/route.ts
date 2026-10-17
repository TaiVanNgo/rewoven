import { apiError, checkOrigin, json } from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { completeQueryFile } from "@/features/query-files/server/repository";
export const maxDuration = 90;
export async function POST(
  request: Request,
  context: RouteContext<"/api/query-files/[id]/complete">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    await completeQueryFile(id, session.id);
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
