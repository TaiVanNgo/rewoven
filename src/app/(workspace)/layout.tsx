import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkspaceEntry } from "@/features/onboarding/workspace-entry";
import { QueryHistoryProvider } from "@/features/queries/query-history";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<p className="p-8">Opening Rewoven…</p>}>
      <WorkspaceEntry>
        <QueryHistoryProvider>
          <WorkspaceShell>{children}</WorkspaceShell>
        </QueryHistoryProvider>
      </WorkspaceEntry>
    </Suspense>
  );
}
