import { Badge } from "@/components/ui/badge";
import type { CaseStatus } from "./types";
export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge
      variant={
        status === "failed"
          ? "destructive"
          : status === "processing"
            ? "caution"
            : "secondary"
      }
    >
      {status === "ready"
        ? "Ready"
        : status === "failed"
          ? "Failed"
          : "Processing"}
    </Badge>
  );
}
