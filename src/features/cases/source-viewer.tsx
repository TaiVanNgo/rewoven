"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { caseApi } from "./api-client";
import type { SourceDocument } from "./types";
import { uploadSource } from "./upload-sources";
import { validateFile } from "./validation";

export function SourceViewer({
  sources,
  readOnly = false,
  onChange,
}: {
  sources: SourceDocument[];
  readOnly?: boolean;
  onChange?: () => void;
}) {
  const [selected, setSelected] = useState(sources[0]?.id ?? "");
  const citationApplied = useRef(false);
  useEffect(() => {
    if (citationApplied.current) return;
    const id = new URLSearchParams(window.location.search).get("source");
    if (id && sources.some((s) => s.id === id)) {
      setSelected(id);
      citationApplied.current = true;
    }
  }, [sources]);
  const source = sources.find((s) => s.id === selected) ?? sources[0];
  return (
    <Card variant="soft">
      <CardHeader>
        <CardTitle>Original sources</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {sources.length} / 50 documents ·{" "}
          {(
            sources.reduce((n, s) => n + (s.byte_size ?? 0), 0) / 1000000
          ).toFixed(2)}{" "}
          / 100 MB ·{" "}
          {sources.reduce((n, s) => n + s.char_count, 0).toLocaleString()} /
          5,000,000 extracted characters
        </p>
        {sources.some(
          (s) => s.status !== "ready" || s.indexing_status !== "ready",
        ) && (
          <Alert variant="caution">
            <AlertTitle>Coverage is incomplete</AlertTitle>
            <AlertDescription>
              Ready text is available for keyword search. Pending or failed
              documents may be missing from semantic results. Processing
              advances while Case library is open.
            </AlertDescription>
          </Alert>
        )}
        {source ? (
          <>
            <Tabs
              value={source.id}
              onValueChange={(value) => setSelected(String(value))}
            >
              <TabsList
                aria-label="Source documents"
                className="h-auto! max-h-56 max-w-full flex-wrap justify-start overflow-y-auto"
              >
                {sources.map((s) => (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    className="max-w-full min-w-0"
                  >
                    <span className="truncate" title={s.title}>
                      {s.title}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <SourceText
              key={source.id}
              source={source}
              readOnly={readOnly}
              onChange={onChange}
            />
          </>
        ) : (
          <p>No sources yet. Add documents to this case.</p>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Original material and source versions are preserved separately from
          extracted text.
        </p>
      </CardFooter>
    </Card>
  );
}
function SourceText({
  source,
  readOnly,
  onChange,
}: {
  source: SourceDocument;
  readOnly: boolean;
  onChange?: () => void;
}) {
  const [page, setPage] = useState(1),
    [start, setStart] = useState(0),
    [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    text: string;
    next: number | null;
  } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("source") === source.id) {
      setPage(Math.max(1, Number(q.get("page")) || 1));
      setStart(Math.max(0, Number(q.get("start")) || 0));
      setHighlight(
        Math.max(
          0,
          (Number(q.get("end")) || 0) - (Number(q.get("start")) || 0),
        ),
      );
    }
  }, [source.id]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly retries loading the retained source segment.
  useEffect(() => {
    if (source.status !== "ready") return;
    const controller = new AbortController();
    setResult(null);
    setError("");
    caseApi<{ text: string; next: number | null }>(
      `/api/sources/${source.id}/text?page=${page}&start=${start}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [source.id, source.status, page, start, revision]);
  async function retry() {
    setBusy(true);
    setError("");
    try {
      await caseApi(`/api/sources/${source.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry: true }),
      });
      onChange?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  }
  async function resume(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      validateFile(file.name, file.size);
      if (
        file.size !== source.byte_size ||
        file.name.slice(0, 200) !== source.title
      )
        throw new Error(
          "Choose the same original filename and file size to resume this upload.",
        );
      await uploadSource(source.case_id, {
        key: source.id,
        file,
        state: "selected",
      });
      onChange?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          Version {source.version} · {source.format.toUpperCase()}
        </Badge>
        <Badge variant="outline">Text: {source.status}</Badge>
        <Badge variant="outline">
          Semantic index: {source.indexing_status}
        </Badge>
      </div>
      {source.status === "extracting" && (
        <output>
          Extracted {source.extraction_cursor} of {source.page_count} pages.
        </output>
      )}
      {(source.error_message || source.indexing_error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {source.error_message || source.indexing_error}
          </AlertDescription>
        </Alert>
      )}
      {!readOnly &&
        (source.status === "failed" || source.indexing_status === "failed") && (
          <Button variant="outline" disabled={busy} onClick={retry}>
            {busy ? "Retrying…" : "Retry this document"}
          </Button>
        )}
      {!readOnly && source.status === "uploading" && (
        <>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".txt,.md,.pdf"
            aria-label="Reselect original document"
            onChange={(e) => void resume(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? "Uploading…" : "Reselect original to resume upload"}
          </Button>
        </>
      )}
      <a
        className={buttonVariants({ variant: "outline" })}
        href={`/api/sources/${source.id}/original${source.format === "pdf" ? `#page=${page}` : ""}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {source.format === "pdf"
          ? "Open original PDF"
          : "Download original text"}
      </a>
      {source.warnings.length > 0 && (
        <Alert variant="caution">
          <AlertTitle>Some content is unavailable</AlertTitle>
          <AlertDescription>{source.warnings.join(" ")}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
          <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
            Reload text
          </Button>
        </Alert>
      )}
      {source.status === "ready" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {source.format === "pdf"
                ? `Extracted text · Page ${page} / ${source.page_count}`
                : "Source text"}{" "}
              · character {start.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 && start === 0}
                onClick={() => {
                  setHighlight(0);
                  if (start > 0) setStart(Math.max(0, start - 10000));
                  else {
                    setPage((p) => p - 1);
                    setStart(0);
                  }
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !result || (!result.next && page >= source.page_count)
                }
                onClick={() => {
                  setHighlight(0);
                  if (result?.next) setStart(result.next);
                  else {
                    setPage((p) => p + 1);
                    setStart(0);
                  }
                }}
              >
                Next
              </Button>
            </div>
          </div>
          <pre
            aria-live="polite"
            className="rounded-card border border-l-4 border-border border-l-foreground bg-card p-5 font-sans text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap"
          >
            {result ? (
              result.text ? (
                highlight ? (
                  <>
                    <mark>{result.text.slice(0, highlight)}</mark>
                    {result.text.slice(highlight)}
                  </>
                ) : (
                  result.text
                )
              ) : (
                "No extractable text on this page."
              )
            ) : (
              "Loading source text…"
            )}
          </pre>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Extracted text will appear after successful processing. Stored
          originals remain available.
        </p>
      )}
    </div>
  );
}
