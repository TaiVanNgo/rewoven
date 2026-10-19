"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ONBOARDING_KEY, readOnboarding, saveOnboarding } from "./model";

const OnboardingContext = createContext<{
  dismissed: boolean | null;
  dismiss: () => void;
  returnTo: string;
  rememberWorkspace: (href: string) => void;
  replayKey: number;
  restart: () => void;
} | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [returnTo, rememberWorkspace] = useState("/");
  const [replayKey, setReplayKey] = useState(0);
  const restart = useCallback(() => setReplayKey((value) => value + 1), []);
  useEffect(() => {
    try {
      const stored = readOnboarding(window.localStorage);
      setDismissed((current) => current === true || stored);
    } catch {
      setDismissed((current) => current === true);
    }
    function sync(event: StorageEvent) {
      if (event.key === ONBOARDING_KEY && event.newValue === "dismissed")
        setDismissed(true);
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      saveOnboarding(window.localStorage);
    } catch {
      // Accessing localStorage itself can throw when browser storage is blocked.
    }
  }, []);

  return (
    <OnboardingContext
      value={{
        dismissed,
        dismiss,
        returnTo,
        rememberWorkspace,
        replayKey,
        restart,
      }}
    >
      {children}
    </OnboardingContext>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error("Onboarding requires OnboardingProvider.");
  return context;
}
