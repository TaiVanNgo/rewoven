import { Suspense } from "react";
import { CaseLibrarySkeleton } from "@/features/cases/case-skeleton";
import { CaseWorkspace } from "@/features/cases/case-workspace";
export default function CaseLibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<CaseLibrarySkeleton />}>
      <CaseWorkspace>{children}</CaseWorkspace>
    </Suspense>
  );
}
