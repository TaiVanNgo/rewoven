import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/workspace/page-header-skeleton";

export default function Loading() {
  return (
    <SkeletonGroup
      label="Loading saved plans page…"
      className="flex flex-col gap-7"
    >
      <PageHeaderSkeleton />
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-panel border border-dashed border-border p-6">
        <Skeleton className="size-10 rounded-control" />
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="h-4 w-2/3 max-w-72" />
        <Skeleton className="mt-2 h-11 w-44 rounded-control" />
      </div>
    </SkeletonGroup>
  );
}
