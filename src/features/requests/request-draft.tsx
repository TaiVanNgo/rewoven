"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

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
  chatDrafts: Record<string, string>;
  updateChatDraft: (id: string, text: string) => void;
} | null>(null);

export function RequestDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const updateChatDraft = useCallback((id: string, text: string) => {
    setChatDrafts((current) => ({ ...current, [id]: text }));
  }, []);
  const updateDraft = useCallback(
    (patch: Partial<RequestDraft>) =>
      setDraft((current) => ({ ...current, ...patch })),
    [],
  );

  return (
    <RequestDraftContext
      value={{
        draft,
        updateDraft,
        chatDrafts,
        updateChatDraft,
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
