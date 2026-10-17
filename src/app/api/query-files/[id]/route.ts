import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { queryDetail } from "@/features/queries/server/repository";
import {
  ownedQueryFile,
  toggleQueryFile,
} from "@/features/query-files/server/repository";
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/query-files/[id]">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    const file = await ownedQueryFile(id, session.id);
    await toggleQueryFile(id, await boundedJson(request), session.id);
    return json({ query: await queryDetail(file.conversation_id, session.id) });
  } catch (error) {
    return apiError(error);
  }
}
