"use client";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LockKeyholeIcon,
} from "lucide-react";
import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SourceDocument } from "./types";

export function SourceViewer({ sources }: { sources: SourceDocument[] }) {
  return (
    <Card variant="soft">
      <CardHeader>
        <CardTitle>Original sources</CardTitle>
      </CardHeader>
      <CardContent>
        {sources.length ? (
          <Tabs defaultValue={sources[0].id}>
            <TabsList
              aria-label="Source documents"
              className="h-auto! max-w-full flex-wrap justify-start"
            >
              {sources.map((source, index) => (
                <TabsTrigger key={source.id} value={source.id}>
                  <FileTextIcon aria-hidden="true" />
                  {source.title}{" "}
                  <span className="font-mono text-xs">[S{index + 1}]</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {sources.map((source) => (
              <TabsContent key={source.id} value={source.id}>
                <SourceText source={source} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <p className="text-muted-foreground">No source is available yet.</p>
        )}
      </CardContent>
      <CardFooter>
        <LockKeyholeIcon className="mr-2 size-4 shrink-0" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">
          Immutable version 1. Original material is kept separately from
          extracted text.
        </p>
      </CardFooter>
    </Card>
  );
}
function SourceText({ source }: { source: SourceDocument }) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = source.pages[pageIndex];
  const original = `/api/sources/${source.id}/original${source.format === "pdf" ? `#page=${page?.number ?? 1}` : ""}`;
  return (
    <div className="flex min-w-0 flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline">
          Version {source.version} ·{" "}
          {source.format === "text"
            ? "Pasted text"
            : source.format.toUpperCase()}
        </Badge>
        <a
          href={original}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
          {source.format === "pdf"
            ? "Open original PDF"
            : "Download original text"}
        </a>
      </div>
      <Separator />
      {source.warnings.length > 0 && (
        <Alert variant="caution">
          <AlertTitle>Some content is unavailable</AlertTitle>
          <AlertDescription>{source.warnings.join(" ")}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {source.format === "pdf"
            ? `Extracted text · Page ${page?.number ?? 1}`
            : "Original source text"}
        </p>
        {source.format === "pdf" && source.pages.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous PDF page"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((i) => i - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="font-mono text-xs" aria-live="polite">
              {pageIndex + 1} / {source.pages.length}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next PDF page"
              disabled={pageIndex >= source.pages.length - 1}
              onClick={() => setPageIndex((i) => i + 1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        )}
      </div>
      <pre className="rounded-card border border-l-4 border-border border-l-foreground bg-card p-5 font-sans text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
        {page
          ? page.text || "No extractable text on this page."
          : "Extracted text will appear after successful processing. You can still open the retained original."}
      </pre>
    </div>
  );
}
