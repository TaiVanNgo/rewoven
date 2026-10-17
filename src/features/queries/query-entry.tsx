"use client";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { QueryWorkspace } from "./query-workspace";
export function QueryEntry({ companion }: { companion: ReactNode }) {
  const params = useSearchParams();
  const id = params.get("query");
  const caseId = params.get("case");
  return (
    <QueryWorkspace
      key={id ?? caseId ?? "new"}
      id={id}
      initialCaseId={caseId}
      companion={companion}
    />
  );
}
