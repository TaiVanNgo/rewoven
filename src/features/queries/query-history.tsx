"use client";

import { MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { caseApi } from "@/features/cases/api-client";
import type { QuerySummary } from "./types";

const HistoryContext = createContext<{
  queries: QuerySummary[];
  error: string;
  refresh: () => Promise<void>;
} | null>(null);
export function QueryHistoryProvider({ children }: { children: ReactNode }) {
  const [queries, setQueries] = useState<QuerySummary[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await caseApi<{ queries: QuerySummary[] }>("/api/queries");
      setQueries(result.queries);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Recent queries are unavailable.",
      );
    }
  }, []);
  useEffect(() => {
    let active = true;
    caseApi("/api/demo-session", { method: "POST" })
      .then(() => {
        if (active) void refresh();
      })
      .catch(() => {
        if (active) setError("Connect Supabase to save and reopen queries.");
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  return (
    <HistoryContext value={{ queries, error, refresh }}>
      {children}
    </HistoryContext>
  );
}
export function useQueryHistory() {
  const context = useContext(HistoryContext);
  if (!context) throw new Error("Query history requires QueryHistoryProvider.");
  return context;
}
export function RecentQueries({ collapsed }: { collapsed: boolean }) {
  const { queries, error } = useQueryHistory();
  return (
    <section
      aria-label="Recent queries"
      className={collapsed ? "hidden" : "flex flex-col gap-2"}
    >
      <h2 className="px-3 text-xs font-semibold text-muted-foreground">
        Recent queries
      </h2>
      {queries.length ? (
        <div className="max-h-56 overflow-y-auto">
          {queries.map((query) => (
            <Link
              key={query.id}
              href={`/?query=${query.id}`}
              prefetch={false}
              title={query.title}
              className="flex items-start gap-2 rounded-control px-3 py-2 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageSquareIcon
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span className="line-clamp-2 wrap-anywhere">{query.title}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="px-3 text-xs leading-relaxed text-muted-foreground">
          {error ||
            "Your submitted queries will appear here for this demo session."}
        </p>
      )}
    </section>
  );
}
