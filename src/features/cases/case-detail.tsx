"use client";
import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AIReadingRecord } from "./ai-reading-record";
import { CaseStatusBadge } from "./case-status";
import { SourceViewer } from "./source-viewer";
import type { CaseDetail as CaseDetailRecord } from "./types";

export function CaseDetail({
  record,
  actions,
  onSourceChange,
}: {
  record: CaseDetailRecord;
  actions?: ReactNode;
  onSourceChange?: () => void;
}) {
  const reviewedSources =
    record.aiReview?.sourceIds ??
    (record.aiReview ? [record.aiReview.sourceId] : []);
  const readingStale =
    !!record.aiReview &&
    (reviewedSources.length !== record.sources.length ||
      record.sources.some((source) => !reviewedSources.includes(source.id)));
  return (
    <section
      id="case-detail"
      aria-label="Selected case"
      className="flex min-w-0 flex-col gap-5"
    >
      <Card variant="soft">
        <CardHeader>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {record.is_seed ? "Fictional sample" : "Your case"}
            </Badge>
            {record.is_seed && <Badge variant="outline">Read-only</Badge>}
            <CaseStatusBadge status={record.status} />
          </div>
          <CardTitle>
            <h2 className="text-xl">{record.title}</h2>
          </CardTitle>
          <CardDescription>
            {record.context ||
              "No project context was supplied. Read the original source below."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {record.outcome ? (
            <div>
              <h3 className="mb-1 font-semibold">Recorded outcome</h3>
              <p className="wrap-anywhere whitespace-pre-wrap">
                {record.outcome}
              </p>
            </div>
          ) : (
            <Alert variant="caution">
              <TriangleAlertIcon aria-hidden="true" />
              <AlertTitle>Outcome not recorded</AlertTitle>
              <AlertDescription>
                The supplied material does not establish whether the previous
                approach succeeded.
              </AlertDescription>
            </Alert>
          )}
          {record.lessons && (
            <div>
              <h3 className="mb-1 font-semibold">Recorded lessons</h3>
              <p className="wrap-anywhere whitespace-pre-wrap">
                {record.lessons}
              </p>
            </div>
          )}
          {record.status === "failed" && (
            <Alert variant="destructive">
              <AlertTitle>Source processing failed</AlertTitle>
              <AlertDescription>{record.error_message}</AlertDescription>
            </Alert>
          )}
          {record.status === "processing" && (
            <p aria-live="polite" className="text-muted-foreground">
              Processing the source. This view updates automatically. If
              processing was interrupted, retry becomes available after two
              minutes.
            </p>
          )}
          {record.aiReading && record.aiReview?.id !== record.aiReading.id && (
            <Alert>
              <AlertTitle>
                {record.aiReading.status === "ready"
                  ? "AI draft ready for review"
                  : record.aiReading.status === "failed"
                    ? "AI reading paused"
                    : "AI reading in progress"}
              </AlertTitle>
              <AlertDescription>
                {record.aiReading.error ??
                  `${record.aiReading.completed}/${record.aiReading.total} sections read across ${record.aiReading.documents} document(s).`}{" "}
                Open Read case with AI to resume or review. Existing case
                details stay unchanged until you confirm.
              </AlertDescription>
            </Alert>
          )}
          {readingStale && (
            <Alert variant="caution">
              <AlertTitle>AI reading needs refresh</AlertTitle>
              <AlertDescription>
                Documents were added after the reviewed reading. Read case with
                AI to include them; your saved edits are preserved until you
                confirm a new draft.
              </AlertDescription>
            </Alert>
          )}
          {actions}
          <Link
            href={`/?case=${record.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Ask Wren about this case
          </Link>
        </CardContent>
      </Card>
      {record.aiReview && <AIReadingRecord review={record.aiReview} />}
      <SourceViewer
        key={record.id}
        sources={record.sources}
        readOnly={record.is_seed}
        onChange={onSourceChange}
      />
    </section>
  );
}
