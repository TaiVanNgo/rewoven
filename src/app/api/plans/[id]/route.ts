import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { planDetail, savePlan } from "@/features/plans/server/repository";
export async function GET(
  _request: Request,
  context: RouteContext<"/api/plans/[id]">,
) {
  try {
    return json({
      plan: await planDetail(
        (await context.params).id,
        (await requireSession()).id,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/plans/[id]">,
) {
  try {
    checkOrigin(request);
    return json({
      plan: await savePlan(
        (await context.params).id,
        await boundedJson(request),
        (await requireSession()).id,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
