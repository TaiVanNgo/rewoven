"use client";

import { isAIPath, OPENAI_KEY_HEADER } from "./validation";

// Deliberately volatile: never put a provider credential in browser storage.
let personalKey = "";
const listeners = new Set<() => void>();

export function setPersonalKey(key: string) {
  personalKey = key;
  for (const listener of listeners) listener();
}
export function hasPersonalKey() {
  return !!personalKey;
}
export function subscribeKey(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function personalKeyOptions(
  path: string,
  options: RequestInit,
): RequestInit {
  const headers = new Headers(options.headers);
  headers.delete(OPENAI_KEY_HEADER);
  if (
    personalKey &&
    options.method?.toUpperCase() === "POST" &&
    isAIPath(path)
  ) {
    headers.set(OPENAI_KEY_HEADER, personalKey);
    // A redirect must never forward this credential to another destination.
    return {
      ...options,
      headers,
      redirect: "error",
      credentials: "same-origin",
    };
  }
  return { ...options, headers };
}
