import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { ApiError, apiError, checkOrigin } from "@/features/cases/server/http";
import { OPENAI_KEY_HEADER, validPersonalKey } from "./validation";

// Request-local only: concurrent visitors must never share credentials.
const credentials = new AsyncLocalStorage<string | null>();

export function openAIKey() {
  return credentials.getStore() ?? process.env.OPENAI_API_KEY;
}

export function withOpenAIKey<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      checkOrigin(request);
      const supplied = request.headers.get(OPENAI_KEY_HEADER);
      if (supplied !== null && !validPersonalKey(supplied))
        throw new ApiError(
          400,
          "Enter a valid OpenAI API key in API key settings.",
        );
      return await credentials.run(supplied, () => handler(request, ...args));
    } catch (error) {
      return apiError(error);
    }
  };
}

export function providerError(status: number, action: string) {
  const personal = !!credentials.getStore();
  return new ApiError(
    status === 429 ? 429 : 502,
    status === 429
      ? `OpenAI could not ${action}: check ${personal ? "your key's" : "the shared key's"} billing, credits, and rate limits, then retry.`
      : `OpenAI could not ${action}. ${personal ? "Replace your key in API key settings and check its model permissions." : "Check the shared API key and model access, or add your own key in API key settings."}`,
  );
}
