import { saveCaseFields } from "@/features/cases/server/case-reading";
import { deleteCase } from "@/features/cases/server/deletion";
import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { caseDetail } from "@/features/cases/server/repository";
import { requireSession } from "@/features/cases/server/session";
import { InputError } from "@/features/cases/validation";
export async function GET(
  _request: Request,
  context: RouteContext<"/api/cases/[id]">,
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return json({ case: await caseDetail(id, session.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/cases/[id]">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    return json({
      case: await saveCaseFields(id, session.id, await boundedJson(request)),
    });
  } catch (error) {
    return error instanceof InputError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/cases/[id]">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    return json(await deleteCase((await context.params).id, session.id));
  } catch (error) {
    return apiError(error);
  }
}
