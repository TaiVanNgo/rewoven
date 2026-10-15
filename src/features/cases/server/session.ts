import "server-only";
import { cookies } from "next/headers";
import {
  hashSessionToken,
  newSessionToken,
  SESSION_SECONDS,
  sessionIsActive,
  validSessionToken,
} from "../session-token";
import { checkDatabase, database } from "./db";
import { ApiError } from "./http";

const COOKIE = "rewoven-session";
export async function currentSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!validSessionToken(token)) return null;
  const { data, error } = await database()
    .from("demo_sessions")
    .select("id, expires_at")
    .eq("token_hash", hashSessionToken(token))
    .maybeSingle();
  checkDatabase(error);
  return data && sessionIsActive(data.expires_at)
    ? (data as { id: string; expires_at: string })
    : null;
}
export async function requireSession() {
  const session = await currentSession();
  if (!session)
    throw new ApiError(
      401,
      "Your demo session has expired. Reload the library to start a new session.",
    );
  return session;
}
export async function initializeSession() {
  const existing = await currentSession();
  if (existing) return existing;
  const token = newSessionToken();
  const { data, error } = await database()
    .from("demo_sessions")
    .insert({ token_hash: hashSessionToken(token) })
    .select("id, expires_at")
    .single();
  checkDatabase(error);
  if (!data)
    throw new ApiError(503, "Could not start a demo session. Try again.");
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return data as { id: string; expires_at: string };
}
