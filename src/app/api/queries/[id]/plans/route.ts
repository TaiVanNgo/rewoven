import { withOpenAIKey } from "@/features/ai-key/server";
import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { processPlan } from "@/features/plans/server/process";
import { createPlan } from "@/features/plans/server/repository";
export const maxDuration = 120;
export const POST = withOpenAIKey(async function POST(
  request: Request,
  context: RouteContext<"/api/queries/[id]/plans">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const plan = await createPlan(
      (await context.params).id,
      await boundedJson(request),
      session.id,
    );
    return json(
      { plan: await processPlan(plan.id, "prepare", {}, session.id) },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
});
