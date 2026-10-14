"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

export type RequestDraft = {
  request: string;
  deadline: string;
  technology: string;
  capabilities: string;
};

const emptyDraft: RequestDraft = {
  request: "",
  deadline: "",
  technology: "",
  capabilities: "",
};

const RequestDraftContext = createContext<{
  draft: RequestDraft;
  updateDraft: (patch: Partial<RequestDraft>) => void;
} | null>(null);

export function RequestDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(emptyDraft);

  return (
    <RequestDraftContext
      value={{
        draft,
        updateDraft: (patch) =>
          setDraft((current) => ({ ...current, ...patch })),
      }}
    >
      {children}
    </RequestDraftContext>
  );
}

export function useRequestDraft() {
  const context = useContext(RequestDraftContext);
  if (!context) {
    throw new Error(
      "useRequestDraft must be used within RequestDraftProvider.",
    );
  }
  return context;
}
