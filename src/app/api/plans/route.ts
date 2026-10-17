import { apiError, json } from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { listPlans } from "@/features/plans/server/repository";
export async function GET(request: Request) {
  const conversationId =
    new URL(request.url).searchParams.get("conversationId") ?? undefined;
  try {
    return json({
      plans: await listPlans((await requireSession()).id, conversationId),
    });
  } catch (error) {
    return apiError(error);
  }
}
