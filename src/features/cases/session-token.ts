import { createHash, randomBytes } from "node:crypto";
export const SESSION_SECONDS = 24 * 60 * 60;
export function newSessionToken() {
  return randomBytes(32).toString("hex");
}
export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function validSessionToken(token: string | undefined): token is string {
  return !!token && /^[a-f0-9]{64}$/.test(token);
}
export function sessionIsActive(expiresAt: string, now = Date.now()) {
  return Date.parse(expiresAt) > now;
}
