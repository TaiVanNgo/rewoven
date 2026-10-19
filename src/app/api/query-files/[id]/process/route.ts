import { withOpenAIKey } from "@/features/ai-key/server";
import {
  apiError,
  boundedJson,
  checkOrigin,
  json,
} from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import {
  listQueryFiles,
  ownedQueryFile,
  processQueryFile,
} from "@/features/query-files/server/repository";
export const maxDuration = 90;
export const POST = withOpenAIKey(async function POST(
  request: Request,
  context: RouteContext<"/api/query-files/[id]/process">,
) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    const input = await boundedJson(request);
    await processQueryFile(id, session.id, input.retry === true);
    return json({
      file: (
        await listQueryFiles(
          (await ownedQueryFile(id, session.id)).conversation_id,
          session.id,
        )
      ).find((file) => file.id === id),
    });
  } catch (error) {
    return apiError(error);
  }
});
