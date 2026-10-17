"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { type RefObject, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { caseApi } from "@/features/cases/api-client";
import {
  type CitationReference,
  citationKey,
  previewQuery,
  type SourcePreview,
} from "./types";

const PdfPage = dynamic(() => import("./pdf-page"), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full" />,
});

export function CitationDialog({
  reference,
  onClose,
  trigger,
}: {
  reference: CitationReference | null;
  onClose: () => void;
  trigger: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog
      open={!!reference}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        finalFocus={trigger}
        initialFocus={false}
        className="max-h-[94dvh] [scrollbar-gutter:stable] overflow-y-auto sm:max-w-5xl"
      >
        <DialogHeader>
          <DialogTitle>
            {reference?.sourceTitle ?? "Supporting source"}
          </DialogTitle>
          <DialogDescription>
            {reference?.caseTitle} · Check the original evidence and its scope.
          </DialogDescription>
        </DialogHeader>
        {reference && (
          <SourceContent key={citationKey(reference)} reference={reference} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SourceContent({ reference }: { reference: CitationReference }) {
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [page, setPage] = useState(reference.page ?? 1);
  const [tab, setTab] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const query = previewQuery(reference, page).toString();
  const sourceId = reference.sourceId;
  // Page-local context is replaced atomically; late replies never replace another page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly retries the same source location.
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    caseApi<SourcePreview>(`/api/sources/${sourceId}/preview?${query}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted)
          setPreview((previous) => ({
            ...data,
            pdfUrl: previous?.pdfUrl ?? data.pdfUrl,
          }));
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [sourceId, query, revision]);

  async function refreshPdf() {
    setRefreshing(true);
    try {
      const data = await caseApi<SourcePreview>(
        `/api/sources/${reference.sourceId}/preview?${previewQuery(reference, page)}`,
      );
      return data.pdfUrl;
    } finally {
      setRefreshing(false);
    }
  }
  const pdf = preview?.source.format === "pdf";
  const activeTab = tab ?? (pdf ? "pdf" : "text");
  const version = reference.version ?? preview?.source.version;
  const original = `/api/sources/${reference.sourceId}/original${version ? `?version=${version}` : ""}${pdf ? `#page=${page}` : ""}`;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        {reference.version === null
          ? "Source version unverified"
          : `Saved version ${reference.version}`}
        {reference.page
          ? ` · Cited physical page ${reference.page}`
          : " · Text excerpt"}
      </p>
      {reference.quote && (
        <blockquote
          className="max-h-36 overflow-y-auto rounded-lg border-l-4 border-knowledge-ink bg-knowledge p-4 text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap"
          aria-label="Saved cited passage"
        >
          {reference.quote}
        </blockquote>
      )}
      {reference.version === null && (
        <p className="text-xs text-caution-foreground">
          This older reference did not record a source version. The viewer shows
          the current source; check it against the saved quote.
        </p>
      )}
      {error ? (
        <Alert variant="caution">
          <AlertDescription>{error}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevision((r) => r + 1)}
          >
            Retry source
          </Button>
        </Alert>
      ) : !preview ? (
        <output aria-label="Loading source">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-3 h-72 w-full" />
        </output>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {preview.source.title} · Version {preview.source.version}
              {pdf
                ? ` · Physical page ${page} of ${preview.source.pageCount}`
                : ""}
            </p>
            <a
              href={original}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open original{pdf ? ` · Page ${page}` : ""}
            </a>
          </div>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setTab(String(value))}
          >
            {pdf && (
              <TabsList aria-label="Source view">
                <TabsTrigger value="pdf">Original PDF</TabsTrigger>
                <TabsTrigger value="text">Extracted text</TabsTrigger>
              </TabsList>
            )}
            {pdf && (
              <TabsContent value="pdf">
                {preview.pdfUrl ? (
                  <PdfPage
                    url={preview.pdfUrl}
                    page={page}
                    onPageChange={setPage}
                    refreshUrl={refreshPdf}
                  />
                ) : (
                  <Alert variant="caution">
                    <AlertDescription>
                      The original PDF is unavailable. Extracted text and the
                      saved quote remain available.
                    </AlertDescription>
                  </Alert>
                )}
                {refreshing && (
                  <output className="mt-2 text-xs text-muted-foreground">
                    Refreshing PDF access…
                  </output>
                )}
              </TabsContent>
            )}
            <TabsContent value="text">
              {pdf && (
                <div className="mb-3 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((n) => n - 1)}
                  >
                    Previous page
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= preview.source.pageCount}
                    onClick={() => setPage((n) => n + 1)}
                  >
                    Next page
                  </Button>
                </div>
              )}
              <p className="mb-2 text-xs text-muted-foreground">
                {pdf ? `Physical page ${page}` : "Source text"} · Context from
                character {preview.start.toLocaleString()}
              </p>
              <section
                className="max-h-[55dvh] overflow-y-auto rounded-lg border border-border bg-card p-5 text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap"
                aria-label="Extracted source text"
                aria-busy={preview.page !== page}
              >
                {preview.page !== page ? (
                  "Loading source text…"
                ) : preview.text ? (
                  preview.highlight ? (
                    <>
                      {preview.text.slice(0, preview.highlight.start)}
                      <mark className="rounded-sm bg-accent text-accent-foreground">
                        {preview.text.slice(
                          preview.highlight.start,
                          preview.highlight.end,
                        )}
                      </mark>
                      {preview.text.slice(preview.highlight.end)}
                    </>
                  ) : (
                    preview.text
                  )
                ) : (
                  "No extractable text on this page."
                )}
              </section>
              {preview.page === page &&
                !preview.highlight &&
                reference.quote &&
                page === (reference.page ?? 1) && (
                  <p className="mt-2 text-xs text-caution-foreground">
                    The saved quote could not be located here. It remains
                    visible above; no unrelated text has been highlighted.
                  </p>
                )}
            </TabsContent>
          </Tabs>
        </>
      )}
      <Link
        className="self-start text-xs font-semibold text-knowledge-ink underline underline-offset-4"
        href={`/case-library/${reference.caseId}`}
      >
        Inspect case
      </Link>
    </div>
  );
}
