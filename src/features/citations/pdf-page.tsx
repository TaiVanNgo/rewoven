"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function PdfPage({
  url,
  page,
  onPageChange,
  refreshUrl,
}: {
  url: string;
  page: number;
  onPageChange: (page: number) => void;
  refreshUrl: () => Promise<string | null>;
}) {
  const pageInputId = useId();
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);
  const [width, setWidth] = useState(700);
  const [rendering, setRendering] = useState(true);
  const [renderedKey, setRenderedKey] = useState("");
  const [revision, setRevision] = useState(0);
  const renderKey = JSON.stringify([url, page, width, zoom]);
  const loading = !document || rendering || renderedKey !== renderKey;
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const refresh = useRef(refreshUrl);
  refresh.current = refreshUrl;
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision retries a failed PDF load on request.
  useEffect(() => {
    let cancelled = false;
    let task:
      ReturnType<(typeof import("pdfjs-dist"))["getDocument"]> | undefined;
    setError("");
    setDocument(null);
    async function load() {
      const pdfjs = await import("pdfjs-dist");
      if (cancelled) return;
      const assets = `/pdfjs/${pdfjs.version}/`;
      pdfjs.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const nextUrl = attempt ? await refresh.current() : url;
          if (cancelled) return;
          if (!nextUrl) throw new Error("The original PDF is unavailable.");
          task = pdfjs.getDocument({
            url: nextUrl,
            cMapUrl: `${assets}cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `${assets}standard_fonts/`,
            wasmUrl: `${assets}wasm/`,
            iccUrl: `${assets}iccs/`,
          });
          const result = await task.promise;
          if (!cancelled) setDocument(result);
          return;
        } catch (reason) {
          await task?.destroy();
          if (cancelled) return;
          if (attempt) throw reason;
        }
      }
    }
    load().catch(() => {
      if (!cancelled)
        setError(
          "The PDF could not be displayed. Try Extracted text or Open original.",
        );
    });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url, revision]);
  // Fit-to-width observes this viewport. Its scrollbar gutter must stay reserved
  // while the loading placeholder replaces the taller PDF canvas below.
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    setRendering(true);
    setError("");
    async function draw() {
      if (!document) return;
      const pdfPage = await document.getPage(page);
      if (cancelled || !canvas.current) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = zoom ?? Math.min(width / base.width, 2);
      const viewport = pdfPage.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const element = canvas.current;
      element.width = Math.floor(viewport.width * ratio);
      element.height = Math.floor(viewport.height * ratio);
      element.style.width = `${viewport.width}px`;
      element.style.height = `${viewport.height}px`;
      const context = element.getContext("2d");
      if (!context) throw new Error("PDF canvas unavailable.");
      render = pdfPage.render({
        canvas: element,
        canvasContext: context,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      await render.promise;
      if (!cancelled) {
        setRenderedKey(JSON.stringify([url, page, width, zoom]));
        setRendering(false);
      }
    }
    draw().catch((reason: Error) => {
      if (!cancelled && reason.name !== "RenderingCancelledException") {
        setRendering(false);
        setError(
          "This PDF page could not be rendered. Try Extracted text or Open original.",
        );
      }
    });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [document, page, width, zoom, url]);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">PDF controls</legend>
        <Button
          variant="outline"
          size="sm"
          disabled={!document || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous page
        </Button>
        <label
          htmlFor={pageInputId}
          className="flex items-center gap-2 text-xs"
        >
          Page{" "}
          <Input
            key={page}
            id={pageInputId}
            aria-label="PDF page number"
            type="number"
            min={1}
            max={document?.numPages ?? 1}
            defaultValue={page}
            disabled={!document}
            className="w-20"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                const number = Number(event.currentTarget.value);
                if (
                  Number.isInteger(number) &&
                  document &&
                  number >= 1 &&
                  number <= document.numPages
                )
                  onPageChange(number);
                else event.currentTarget.value = String(page);
              }
            }}
            onBlur={(event) => {
              const number = Number(event.currentTarget.value);
              if (
                Number.isInteger(number) &&
                document &&
                number >= 1 &&
                number <= document.numPages
              )
                onPageChange(number);
              else event.currentTarget.value = String(page);
            }}
          />
          of {document?.numPages ?? "…"}
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={!document || page >= document.numPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next page
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Zoom out"
          disabled={!document}
          onClick={() => setZoom((value) => Math.max(0.5, (value ?? 1) - 0.25))}
        >
          −
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Zoom in"
          disabled={!document}
          onClick={() => setZoom((value) => Math.min(3, (value ?? 1) + 0.25))}
        >
          +
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!document}
          onClick={() => setZoom(null)}
        >
          Fit to width
        </Button>
      </fieldset>
      {error && (
        <Alert variant="caution">
          <AlertDescription>{error}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry PDF
          </Button>
        </Alert>
      )}
      <div
        ref={container}
        className="max-h-[60dvh] min-h-48 [scrollbar-gutter:stable] overflow-auto rounded-lg border border-border bg-muted"
        aria-busy={!error && loading}
      >
        {!error && loading && (
          <output aria-label="Rendering PDF page">
            <Skeleton className="h-48 w-full" />
          </output>
        )}
        <canvas
          ref={canvas}
          aria-label={`Original PDF, physical page ${page}`}
          role="img"
          className={loading || error ? "hidden" : "mx-auto"}
        />
      </div>
    </div>
  );
}
