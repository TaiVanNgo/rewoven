"use client";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { caseApi } from "./api-client";
import { type CaseDetail, PROCESSING_LEASE_MS } from "./types";

export function RetryCase({
  record,
  onProcessed,
}: {
  record: CaseDetail;
  onProcessed: (record: CaseDetail) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const interrupted =
    record.status === "processing" &&
    Date.now() - Date.parse(record.processing_started_at) >=
      PROCESSING_LEASE_MS;
  if (record.is_seed || (record.status !== "failed" && !interrupted))
    return null;
  async function retry() {
    setPending(true);
    setError("");
    try {
      const result = await caseApi<{ case: CaseDetail }>(
        `/api/cases/${record.id}/retry`,
        { method: "POST" },
      );
      onProcessed(result.case);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Retry could not finish.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex flex-col items-start gap-3">
      {interrupted && (
        <p className="text-sm text-muted-foreground">
          Processing appears to have been interrupted. Retry the retained
          original.
        </p>
      )}
      <Button variant="outline" disabled={pending} onClick={retry}>
        <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
        {pending ? "Retrying…" : "Retry processing"}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
