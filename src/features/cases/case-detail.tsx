"use client";
import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CaseStatusBadge } from "./case-status";
import { SourceViewer } from "./source-viewer";
import type { CaseDetail as CaseDetailRecord } from "./types";

export function CaseDetail({
  record,
  actions,
}: {
  record: CaseDetailRecord;
  actions?: ReactNode;
}) {
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
          {actions}
        </CardContent>
      </Card>
      <SourceViewer key={record.id} sources={record.sources} />
    </section>
  );
}
