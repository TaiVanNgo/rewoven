import { apiError, checkOrigin, json } from "@/features/cases/server/http";
import { boundedFormData, createCase } from "@/features/cases/server/ingestion";
import { listCases } from "@/features/cases/server/repository";
import { requireSession } from "@/features/cases/server/session";
import { InputError } from "@/features/cases/validation";
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    return json({
      cases: await listCases(
        session.id,
        new URL(request.url).searchParams.get("q") ?? "",
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const record = await createCase(await boundedFormData(request), session.id);
    return json({ case: record }, 201);
  } catch (error) {
    return error instanceof InputError
      ? json({ error: error.message }, 400)
      : apiError(error);
  }
}
