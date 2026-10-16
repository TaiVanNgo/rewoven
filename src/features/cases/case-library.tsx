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
import { AddCaseDialog } from "./add-case-dialog";
import { caseApi } from "./api-client";
import { CaseDetail } from "./case-detail";
import {
  CaseDetailSkeleton,
  CaseLibrarySkeleton,
  CaseListSkeleton,
} from "./case-skeleton";
import { CaseStatusBadge } from "./case-status";
import { RetryCase } from "./retry-case";
import type { CaseDetail as CaseDetailRecord, CaseSummary } from "./types";

export function CaseLibrary() {
  const [processingError, setProcessingError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [query, setQuery] = useState("");
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [bootAttempt, setBootAttempt] = useState(0);
  const searching = resolvedQuery !== null && query !== resolvedQuery && !error;
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
          if (controller.signal.aborted) return;
          setCases(data.cases);
          setResolvedQuery(query);
          setSelectedId((current) =>
            data.cases.some((c) => c.id === current)
              ? current
              : (data.cases.find(
                  (c) =>
                    c.id ===
                    new URLSearchParams(window.location.search).get("case"),
                )?.id ??
                data.cases.find((c) => c.title === "Expense Approval Portal")
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
    setDetailError(null);
    setDetailLoading(true);
    caseApi<{ case: CaseDetailRecord }>(`/api/cases/${selectedId}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setDetail(data.case);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setDetailError({ id: selectedId, message: error.message });
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selectedId, revision]);
  useEffect(() => {
    if (
      loading ||
      detailLoading ||
      searching ||
      error ||
      detailError ||
      !cases.some((c) => c.status === "processing")
    )
      return;
    // Wait for current requests to settle so polling never cancels a slow load.
    const timer = setTimeout(() => setRevision((r) => r + 1), 2000);
    return () => clearTimeout(timer);
  }, [cases, loading, detailLoading, searching, error, detailError]);
  useEffect(() => {
    if (!sessionReady) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function advance() {
      try {
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
          if (active) setRevision((n) => n + 1);
        }
        if (active) {
          setProcessingError("");
          timer = setTimeout(advance, next ? 500 : 3000);
        }
      } catch (error) {
        if (active) {
          setProcessingError(
            error instanceof Error ? error.message : "Processing paused.",
          );
          timer = setTimeout(advance, 10000);
        }
      }
    }
    void advance();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [sessionReady]);
  function onCreated(record: CaseDetailRecord) {
    setQuery("");
    setSelectedId(record.id);
    setDetail(record);
    setRevision((r) => r + 1);
  }
  function onProcessed(record: CaseDetailRecord) {
    setDetail(record);
    setRevision((r) => r + 1);
  }
  return (
    <div className="case-library flex flex-col gap-5">
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
            onChange={(event) => {
              setQuery(event.target.value);
              if (sessionReady) setError("");
            }}
          />
        </Field>
        <AddCaseDialog disabled={!sessionReady} onCreated={onCreated} />
      </div>
      {processingError && (
        <Alert variant="caution">
          <AlertTitle>Processing paused</AlertTitle>
          <AlertDescription>
            {processingError} We will retry while this page is open.
          </AlertDescription>
        </Alert>
      )}
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
      {resolvedQuery === null && !error ? (
        <CaseLibrarySkeleton />
      ) : !cases.length && !error && !searching ? (
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
        (cases.length > 0 || searching) && (
          <div className="case-library-grid grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.8fr)]">
            {searching ? (
              <CaseListSkeleton />
            ) : (
              <aside
                aria-label="Case list"
                aria-busy={loading}
                className="case-list flex min-w-0 flex-col gap-3 rounded-panel border border-border bg-muted p-4"
              >
                <div className="flex items-center justify-between px-1">
                  <h2
                    id="cases-title"
                    className="font-heading text-sm font-bold"
                  >
                    Cases
                  </h2>
                  <Badge variant="outline" aria-live="polite">
                    {cases.length}
                    {query ? " found" : " total"}
                  </Badge>
                </div>
                <section
                  aria-labelledby="cases-title"
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this independently scrollable region.
                  tabIndex={0}
                  className="case-list-scroll flex max-h-[680px] flex-col gap-3 overflow-y-auto p-1"
                >
                  {cases.map((record) => (
                    <Button
                      key={record.id}
                      variant={
                        selectedId === record.id ? "case-active" : "case"
                      }
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
                </section>
              </aside>
            )}
            <section
              key={selectedId}
              aria-label="Case content"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this independently scrollable region.
              tabIndex={0}
              className="case-content flex min-w-0 flex-col gap-5"
            >
              {detailError?.id === selectedId && (
                <Alert
                  id={detail?.id === selectedId ? undefined : "case-detail"}
                  variant="destructive"
                >
                  <AlertTitle>Could not load this case</AlertTitle>
                  <AlertDescription>
                    {detailError.message}
                    {detail?.id === selectedId && (
                      <p>Showing the last loaded details until you retry.</p>
                    )}
                  </AlertDescription>
                  <Button
                    variant="outline"
                    onClick={() => setRevision((r) => r + 1)}
                  >
                    Try again
                  </Button>
                </Alert>
              )}
              {detail?.id === selectedId ? (
                <CaseDetail
                  key={detail.id}
                  record={detail}
                  onSourceChange={() => setRevision((n) => n + 1)}
                  actions={
                    <div className="flex flex-wrap gap-3">
                      <RetryCase record={detail} onProcessed={onProcessed} />
                      {!detail.is_seed && (
                        <AddCaseDialog
                          caseId={detail.id}
                          existingSources={detail.sources}
                          disabled={!sessionReady}
                          onCreated={onProcessed}
                        />
                      )}
                    </div>
                  }
                />
              ) : detailError?.id !== selectedId ? (
                <CaseDetailSkeleton />
              ) : null}
            </section>
          </div>
        )
      )}
    </div>
  );
}
