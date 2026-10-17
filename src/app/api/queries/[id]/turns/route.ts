import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { processAssistantTurn } from "@/features/queries/server/process-assistant";
import { processQueryTurn } from "@/features/queries/server/process-turn";
import { queryDetail } from "@/features/queries/server/repository";
import { QueryInputError } from "@/features/queries/validation";

export const maxDuration = 240;
export async function POST(
  request: Request,
  context: RouteContext<"/api/queries/[id]/turns">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const id = (await context.params).id;
    const query = await queryDetail(id, session.id);
    const input = await boundedJson(request);
    const prior = query.turns.find((turn) => turn.id === input.requestKey);
    const assistant = query.assistant && (!prior || !!prior.context_snapshot);
    return json({
      query: await (assistant ? processAssistantTurn : processQueryTurn)(
        id,
        input,
        session.id,
      ),
    });
  } catch (error) {
    return error instanceof QueryInputError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
}
