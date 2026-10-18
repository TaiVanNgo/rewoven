import { cleanupDeletedCases } from "@/features/cases/server/deletion";
import { apiError, checkOrigin, json } from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    return json(await cleanupDeletedCases(session.id));
  } catch (error) {
    return apiError(error);
  }
}
