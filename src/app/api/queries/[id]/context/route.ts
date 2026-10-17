import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { updateChatContext } from "@/features/queries/server/repository";
import { QueryInputError } from "@/features/queries/validation";
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/queries/[id]/context">,
) {
  try {
    checkOrigin(request);
    return json({
      query: await updateChatContext(
        (await context.params).id,
        await boundedJson(request),
        (await requireSession()).id,
      ),
    });
  } catch (error) {
    return error instanceof QueryInputError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
}
