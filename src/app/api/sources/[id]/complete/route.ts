import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { completeSource } from "@/features/cases/server/sources";
export async function POST(
  request: Request,
  context: RouteContext<"/api/sources/[id]/complete">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    const body = await boundedJson(request);
    return json(
      await completeSource(
        id,
        session.id,
        typeof body.analysisId === "string" ? body.analysisId : undefined,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
