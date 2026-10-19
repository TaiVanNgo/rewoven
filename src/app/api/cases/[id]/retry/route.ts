import { withOpenAIKey } from "@/features/ai-key/server";
import { apiError, checkOrigin, json } from "@/features/cases/server/http";
import { processCase } from "@/features/cases/server/ingestion";
import { requireSession } from "@/features/cases/server/session";
export const POST = withOpenAIKey(async function POST(
  request: Request,
  context: RouteContext<"/api/cases/[id]/retry">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    return json({ case: await processCase(id, session.id) });
  } catch (error) {
    return apiError(error);
  }
});
