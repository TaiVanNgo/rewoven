import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { ownedSource, processSource } from "@/features/cases/server/sources";
export async function POST(
  request: Request,
  context: RouteContext<"/api/sources/[id]/process">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    const body = await boundedJson(request);
    await processSource(id, session.id, body.retry === true);
    const source = await ownedSource(id, session.id);
    return json({
      status: source.status,
      indexing_status: source.indexing_status,
      error_message: source.error_message,
      indexing_error: source.indexing_error,
    });
  } catch (error) {
    return apiError(error);
  }
}
