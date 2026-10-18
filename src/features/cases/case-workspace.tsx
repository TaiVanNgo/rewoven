"use client";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { caseApi } from "./api-client";
import type { CaseSummary } from "./types";

const Workspace = createContext({
  ready: false,
  error: "",
  revision: 0,
  refresh: () => {},
  retry: () => {},
});
export function CaseWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeRoute = pathname.startsWith("/case-library");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt retries session initialization.
  useEffect(() => {
    let active = true;
    setError("");
    setReady(false);
    void caseApi("/api/demo-session", { method: "POST" })
      .then(() => {
        if (active) setReady(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!ready || !activeRoute) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let lastCleanup = 0;
    async function advance() {
      let delay = 3000;
      try {
        if (Date.now() - lastCleanup >= 30_000) {
          lastCleanup = Date.now();
          // File cleanup is independent of document processing. A transient
          // cleanup error must not pause indexing other cases.
          void caseApi("/api/cases/cleanup", { method: "POST" }).catch(
            () => {},
          );
        }
        const result = await caseApi<{ cases: CaseSummary[] }>("/api/cases");
        const next = result.cases
          .filter((c) => !c.is_seed)
          .flatMap((c) => c.sources)
          .find(
            (s) =>
              s.status === "queued" ||
              s.status === "extracting" ||
              (s.status === "ready" && s.indexing_status === "pending"),
          );
        if (active && next) {
          await caseApi(`/api/sources/${next.id}/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (active) refresh();
          delay = 500;
        }
        if (active) setError("");
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Document processing paused.",
          );
        delay = 10000;
      }
      if (active) timer = setTimeout(advance, delay);
    }
    void advance();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ready, activeRoute, refresh]);
  return (
    <Workspace.Provider value={{ ready, error, revision, refresh, retry }}>
      {children}
    </Workspace.Provider>
  );
}
export function useCaseWorkspace() {
  return useContext(Workspace);
}
