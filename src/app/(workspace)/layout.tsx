import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { QueryHistoryProvider } from "@/features/queries/query-history";
import { RequestDraftProvider } from "@/features/requests/request-draft";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <RequestDraftProvider>
      <QueryHistoryProvider>
        <WorkspaceShell>{children}</WorkspaceShell>
      </QueryHistoryProvider>
    </RequestDraftProvider>
  );
}
