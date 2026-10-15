import { SkeletonGroup } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/workspace/page-header-skeleton";
import { CaseLibrarySkeleton } from "@/features/cases/case-skeleton";

export default function Loading() {
  return (
    <SkeletonGroup
      label="Loading case library page…"
      className="flex flex-col gap-7"
    >
      <PageHeaderSkeleton />
      <CaseLibrarySkeleton withToolbar />
    </SkeletonGroup>
  );
}
