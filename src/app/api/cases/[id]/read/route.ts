import { withOpenAIKey } from "@/features/ai-key/server";
import { advanceCaseReading } from "@/features/cases/server/case-reading";
import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
export const POST = withOpenAIKey(async function POST(
  request: Request,
  context: RouteContext<"/api/cases/[id]/read">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    const body = await boundedJson(request);
    return json(
      await advanceCaseReading(
        id,
        session.id,
        typeof body.readingId === "string" ? body.readingId : undefined,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
});
