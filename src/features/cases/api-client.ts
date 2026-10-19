import { personalKeyOptions } from "@/features/ai-key/client";

export async function caseApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...personalKeyOptions(path, options),
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error ?? "Case storage could not be reached. Try again.",
    );
  return body as T;
}
