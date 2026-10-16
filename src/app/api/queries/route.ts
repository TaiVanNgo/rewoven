import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { createQuery, listQueries } from "@/features/queries/server/repository";
import { QueryInputError } from "@/features/queries/validation";

export async function GET() {
  try {
    return json({ queries: await listQueries((await requireSession()).id) });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    return json(
      { query: await createQuery(await boundedJson(request), session.id) },
      201,
    );
  } catch (error) {
    return error instanceof QueryInputError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
}
