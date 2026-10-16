import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { retrieve } from "@/features/retrieval/server/retrieve";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    return json(await retrieve(await boundedJson(request), session.id));
  } catch (error) {
    return apiError(error);
  }
}
