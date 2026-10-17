import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { queryDetail } from "@/features/queries/server/repository";
import { reserveQueryFiles } from "@/features/query-files/server/repository";
export async function POST(
  request: Request,
  context: RouteContext<"/api/queries/[id]/files">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    const input = await boundedJson(request);
    await reserveQueryFiles(id, input.files, session.id);
    return json({ query: await queryDetail(id, session.id) });
  } catch (error) {
    return apiError(error);
  }
}
