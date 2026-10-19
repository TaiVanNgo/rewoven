import { withOpenAIKey } from "@/features/ai-key/server";
import { analyzeSource } from "@/features/cases/server/analyze-source";
import { apiError, checkOrigin, json } from "@/features/cases/server/http";
import { boundedFormData } from "@/features/cases/server/ingestion";
import { requireSession } from "@/features/cases/server/session";
import { InputError } from "@/features/cases/validation";

export const POST = withOpenAIKey(async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    return json(
      await analyzeSource(await boundedFormData(request), session.id),
    );
  } catch (error) {
    return error instanceof InputError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
});
