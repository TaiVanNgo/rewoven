import { reviewCaseReading } from "@/features/cases/server/case-reading";
import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { InputError } from "@/features/cases/validation";
export async function POST(
  request: Request,
  context: RouteContext<"/api/cases/[id]/review">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    return json({
      case: await reviewCaseReading(id, session.id, await boundedJson(request)),
    });
  } catch (error) {
    return error instanceof InputError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
}
