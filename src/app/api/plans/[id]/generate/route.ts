import { withOpenAIKey } from "@/features/ai-key/server";
import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { processPlan } from "@/features/plans/server/process";
export const maxDuration = 120;
export const POST = withOpenAIKey(async function POST(
  request: Request,
  context: RouteContext<"/api/plans/[id]/generate">,
) {
  try {
    checkOrigin(request);
    return json({
      plan: await processPlan(
        (await context.params).id,
        "generate",
        await boundedJson(request),
        (await requireSession()).id,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
});
