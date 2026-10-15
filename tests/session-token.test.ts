import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hashSessionToken,
  newSessionToken,
  SESSION_SECONDS,
  sessionIsActive,
  validSessionToken,
} from "../src/features/cases/session-token";

test("session tokens are opaque, unique, and stored as hashes", () => {
  const a = newSessionToken();
  const b = newSessionToken();
  assert.ok(validSessionToken(a));
  assert.notEqual(a, b);
  assert.notEqual(hashSessionToken(a), a);
  assert.equal(hashSessionToken(a), hashSessionToken(a));
  assert.ok(!validSessionToken("guessed-owner-id"));
  assert.ok(!validSessionToken(undefined));
});
test("sessions expire at the boundary and reject invalid dates", () => {
  const now = Date.now();
  assert.equal(SESSION_SECONDS, 86400);
  assert.ok(sessionIsActive(new Date(now + 1).toISOString(), now));
  assert.ok(!sessionIsActive(new Date(now).toISOString(), now));
  assert.ok(!sessionIsActive("invalid", now));
});
