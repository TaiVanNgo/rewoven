import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  needsOnboarding,
  ONBOARDING_KEY,
  parseStarter,
  readOnboarding,
  saveOnboarding,
  starterPrompts,
} from "../src/features/onboarding/model";

test("only a fresh homepage opens onboarding; deep links and drafts remain usable", () => {
  const needs = (path = "/", query = "", dismissed = false, draft = false) =>
    needsOnboarding(path, new URLSearchParams(query), dismissed, draft);
  assert.equal(needs(), true);
  assert.equal(needs("/", "", true), false);
  assert.equal(needs("/", "", false, true), false);
  for (const path of [
    "/case-library",
    "/case-library/a",
    "/saved-plans",
    "/saved-plans/a",
  ])
    assert.equal(needs(path), false);
  for (const query of [
    "query=saved",
    "case=selected",
    "query=",
    "case=",
    "starter=history",
    "starter=request",
  ])
    assert.equal(needs("/", query), false);
  assert.equal(needs("/", "starter=unknown"), true);
});

test("starter values are a fixed allowlist, not arbitrary prompts or destinations", () => {
  assert.equal(parseStarter("history"), "history");
  assert.equal(parseStarter("request"), "request");
  for (const value of [
    null,
    "",
    "toString",
    "constructor",
    "https://other.test",
    "HISTORY",
  ])
    assert.equal(parseStarter(value), null);
  assert.match(starterPrompts.history, /duplicate submissions/);
  assert.match(starterPrompts.request, /what is still unknown/);
});

test("dismissal is persisted independently of the demo session and tolerates blocked storage", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  assert.equal(readOnboarding(storage), false);
  saveOnboarding(storage);
  assert.deepEqual([...values], [[ONBOARDING_KEY, "dismissed"]]);
  assert.equal(readOnboarding(storage), true);
  const blocked = {
    getItem: () => {
      throw new Error("Storage blocked");
    },
    setItem: () => {
      throw new Error("Storage blocked");
    },
  };
  assert.equal(readOnboarding(blocked), false);
  assert.doesNotThrow(() => saveOnboarding(blocked));
});
