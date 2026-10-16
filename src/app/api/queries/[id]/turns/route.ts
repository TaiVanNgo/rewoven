import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { processQueryTurn } from "@/features/queries/server/process-turn";
import { QueryInputError } from "@/features/queries/validation";

export const maxDuration = 240;
export async function POST(
  request: Request,
  context: RouteContext<"/api/queries/[id]/turns">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    return json({
      query: await processQueryTurn(
        (await context.params).id,
        await boundedJson(request),
        session.id,
      ),
    });
  } catch (error) {
    return error instanceof QueryInputError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
}
