import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { RequestDraftProvider } from "@/features/requests/request-draft";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <RequestDraftProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </RequestDraftProvider>
  );
}
