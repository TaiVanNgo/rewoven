import { type ReactNode, Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 md:p-shell">
      <a
        href="#main-content"
        className="sr-only z-10 rounded-control bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <div className="mx-auto flex min-h-[calc(100dvh-56px)] max-w-[1540px] flex-col items-stretch gap-gutter lg:flex-row">
        <Suspense
          fallback={
            <div
              className="shrink-0 rounded-workspace border border-border bg-card p-5 lg:w-[270px]"
              aria-hidden="true"
            >
              Rewoven
            </div>
          }
        >
          <WorkspaceSidebar />
        </Suspense>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-w-0 flex-1 flex-col justify-between rounded-workspace border border-border bg-card p-5 shadow-panel md:p-9"
        >
          <div className="flex flex-col gap-7">{children}</div>
          <footer className="mt-6 flex flex-col gap-6">
            <Separator />
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Fictional samples are shared and read-only. Your added cases and
              queries stay in your demo session for 24 hours. Unsubmitted drafts
              reset on reload.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
