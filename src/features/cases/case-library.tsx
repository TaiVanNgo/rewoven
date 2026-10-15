"use client";
import { ArchiveIcon, FileTextIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { caseApi } from "./api-client";
import { CaseDetail } from "./case-detail";
import { CaseStatusBadge } from "./case-status";
import type { CaseDetail as CaseDetailRecord, CaseSummary } from "./types";

export function CaseLibrary() {
  const [sessionReady, setSessionReady] = useState(false);
  const [query, setQuery] = useState("");
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [bootAttempt, setBootAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: bootAttempt explicitly retries session initialization.
  useEffect(() => {
    let active = true;
    caseApi("/api/demo-session", { method: "POST" })
      .then(() => {
        if (active) {
          setSessionReady(true);
          setError("");
          setRevision((r) => r + 1);
        }
      })
      .catch((error) => {
        if (active) {
          setError(error.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [bootAttempt]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision triggers refetch after polling and mutations.
  useEffect(() => {
    if (!sessionReady) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      caseApi<{ cases: CaseSummary[] }>(
        `/api/cases?q=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      )
        .then((data) => {
          setCases(data.cases);
          setSelectedId((current) =>
            data.cases.some((c) => c.id === current)
              ? current
              : (data.cases.find((c) => c.title === "Expense Approval Portal")
                  ?.id ??
                data.cases[0]?.id ??
                null),
          );
          setError("");
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(error.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sessionReady, query, revision]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision refreshes the currently selected case.
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    caseApi<{ case: CaseDetailRecord }>(`/api/cases/${selectedId}`, {
      signal: controller.signal,
    })
      .then((data) => setDetail(data.case))
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [selectedId, revision]);
  useEffect(() => {
    if (!cases.some((c) => c.status === "processing")) return;
    const timer = setInterval(() => setRevision((r) => r + 1), 2000);
    return () => clearInterval(timer);
  }, [cases]);
  return (
    <div className="flex flex-col gap-5" aria-busy={loading}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field className="max-w-sm">
          <FieldLabel htmlFor="case-search">
            Search cases and source text
          </FieldLabel>
          <Input
            id="case-search"
            type="search"
            placeholder="Search the archive"
            maxLength={200}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Your additions stay in this demo session for 24 hours.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load the library</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button
            variant="outline"
            onClick={() => setBootAttempt((n) => n + 1)}
          >
            <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
        </Alert>
      )}
      {loading && !cases.length && !error ? (
        <LibraryLoading />
      ) : !cases.length && !error ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArchiveIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {query ? "No matching cases" : "The archive is empty"}
            </EmptyTitle>
            <EmptyDescription>
              {query
                ? "Try another word from a case title or source. Only ready cases appear in search results."
                : "Add a case to begin, or run the local seed command to load fictional samples."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        cases.length > 0 && (
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.8fr)]">
            <aside
              aria-label="Case list"
              className="flex min-w-0 flex-col gap-3 rounded-panel border border-border bg-muted p-4"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="font-heading text-sm font-bold">Cases</h2>
                <Badge variant="outline" aria-live="polite">
                  {cases.length}
                  {query ? " found" : " total"}
                </Badge>
              </div>
              <div className="flex max-h-[680px] flex-col gap-3 overflow-y-auto p-1">
                {cases.map((record) => (
                  <Button
                    key={record.id}
                    variant={selectedId === record.id ? "case-active" : "case"}
                    aria-pressed={selectedId === record.id}
                    aria-controls="case-detail"
                    onClick={() => setSelectedId(record.id)}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-heading font-bold wrap-anywhere">
                        {record.title}
                      </span>
                      <CaseStatusBadge status={record.status} />
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">
                        {record.is_seed ? "Fictional sample" : "Your case"}
                      </Badge>
                      {record.is_seed && (
                        <Badge variant="outline">Read-only</Badge>
                      )}
                    </span>
                    <span className="line-clamp-2 text-sm leading-relaxed font-normal text-muted-foreground">
                      {record.context ||
                        "Original source available for inspection."}
                    </span>
                    <span className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs font-normal text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileTextIcon aria-hidden="true" />
                        {record.sources.length}{" "}
                        {record.sources.length === 1 ? "source" : "sources"}
                      </span>
                      <span>
                        {record.outcome
                          ? "Outcome recorded"
                          : "Outcome not recorded"}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </aside>
            {detail?.id === selectedId ? (
              <CaseDetail key={detail.id} record={detail} />
            ) : (
              <LibraryLoading />
            )}
          </div>
        )
      )}
    </div>
  );
}
function LibraryLoading() {
  return (
    <div aria-live="polite" className="flex flex-col gap-4">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-64 w-full" />
      <span className="sr-only">Loading case library…</span>
    </div>
  );
}
