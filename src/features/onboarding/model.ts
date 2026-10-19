export const ONBOARDING_KEY = "rewoven-onboarding-v1";

export const onboardingSteps = [
  "Meet Threadline Delivery",
  "Nine projects to learn from",
  "Ask Wren and check the evidence",
  "Northbank brings a new request",
  "Turn lessons into a plan",
] as const;

export const starterPrompts = {
  history:
    "What can we learn from our past projects about preventing duplicate submissions when a connection drops after Send?",
  request:
    "Which previous projects help with this request? Explain what we can reuse, what changes, and what is still unknown.",
} as const;

export type OnboardingStarter = keyof typeof starterPrompts;

export function parseStarter(value: string | null): OnboardingStarter | null {
  return value === "history" || value === "request" ? value : null;
}

export function needsOnboarding(
  pathname: string,
  params: URLSearchParams,
  dismissed: boolean,
  hasDraft: boolean,
) {
  return (
    pathname === "/" &&
    !dismissed &&
    !hasDraft &&
    !params.has("query") &&
    !params.has("case") &&
    !parseStarter(params.get("starter"))
  );
}

// Preference storage is optional. It never controls access to demo data.
export function readOnboarding(storage: Pick<Storage, "getItem">) {
  try {
    return storage.getItem(ONBOARDING_KEY) === "dismissed";
  } catch {
    return false;
  }
}

export function saveOnboarding(storage: Pick<Storage, "setItem">) {
  try {
    storage.setItem(ONBOARDING_KEY, "dismissed");
  } catch {
    // The provider also remembers dismissal in memory for this page lifetime.
  }
}
