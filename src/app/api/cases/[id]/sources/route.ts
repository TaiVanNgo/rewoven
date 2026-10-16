import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import {
  reconcileUploads,
  reserveSource,
} from "@/features/cases/server/sources";
import { InputError } from "@/features/cases/validation";
export async function POST(
  request: Request,
  context: RouteContext<"/api/cases/[id]/sources">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    await reconcileUploads(id, session.id);
    return json(
      await reserveSource(id, await boundedJson(request), session.id),
      201,
    );
  } catch (error) {
    return error instanceof InputError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
}
