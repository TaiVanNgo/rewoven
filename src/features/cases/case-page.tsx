"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/workspace/theme-toggle";
import { AddCaseDialog } from "./add-case-dialog";
import { caseApi } from "./api-client";
import { CaseDetail } from "./case-detail";
import { CaseDetailSkeleton } from "./case-skeleton";
import { useCaseWorkspace } from "./case-workspace";
import { EditOverviewDialog } from "./edit-overview-dialog";
import { RetryCase } from "./retry-case";
import type { CaseDetail as CaseDetailRecord } from "./types";

export function CasePage({ id }: { id: string }) {
  const params = useSearchParams();
  const query = params.get("q");
  const {
    ready,
    revision,
    refresh,
    retry,
    error: workspaceError,
  } = useCaseWorkspace();
  const [record, setRecord] = useState<CaseDetailRecord | null>(null);
  const [error, setError] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision reloads the case after saves and source processing.
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setError("");
    void caseApi<{ case: CaseDetailRecord }>(`/api/cases/${id}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!controller.signal.aborted) setRecord(r.case);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, ready, revision]);
  function saved(next: CaseDetailRecord) {
    setRecord(next);
    refresh();
  }
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/case-library${query ? `?q=${encodeURIComponent(query)}` : ""}`}
          className="self-start text-sm font-semibold underline underline-offset-4"
        >
          Back to case library
        </Link>
        <ThemeToggle />
      </div>
      {(error || workspaceError) && (
        <Alert variant="caution">
          <AlertTitle>Case needs attention</AlertTitle>
          <AlertDescription>{error || workspaceError}</AlertDescription>
          <Button
            variant="outline"
            onClick={() => {
              retry();
              refresh();
            }}
          >
            Reload case
          </Button>
        </Alert>
      )}
      {!record || record.id !== id ? (
        !error && !workspaceError ? (
          <CaseDetailSkeleton />
        ) : null
      ) : (
        <>
          <CaseDetail
            record={record}
            onSourceChange={refresh}
            actions={
              !record.is_seed ? (
                <>
                  <EditOverviewDialog record={record} onSaved={saved} />
                  <AddCaseDialog
                    key={`read-${record.id}-${record.overviewRevision}`}
                    disabled={!ready}
                    caseId={id}
                    existingSources={record.sources}
                    existingCase={record}
                    readExisting
                    onCreated={saved}
                    onPrepared={saved}
                  />
                  <AddCaseDialog
                    key={`add-${record.id}-${record.overviewRevision}`}
                    disabled={!ready}
                    caseId={id}
                    existingSources={record.sources}
                    existingCase={record}
                    onCreated={saved}
                    onPrepared={saved}
                  />
                </>
              ) : undefined
            }
          />
          <RetryCase record={record} onProcessed={saved} />
        </>
      )}
    </div>
  );
}
