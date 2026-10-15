import { apiError, checkOrigin, json } from "@/features/cases/server/http";
import { initializeSession } from "@/features/cases/server/session";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await initializeSession();
    return json({ expiresAt: session.expires_at });
  } catch (error) {
    return apiError(error);
  }
}
