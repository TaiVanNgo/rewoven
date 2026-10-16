import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

export function CaseLibrarySkeleton({
  withToolbar = false,
}: {
  withToolbar?: boolean;
}) {
  return (
    <SkeletonGroup
      label="Loading case library…"
      className="flex flex-col gap-6"
    >
      {withToolbar && (
        <div className="flex justify-between gap-4">
          <Skeleton className="h-16 w-full max-w-md rounded-control" />
          <Skeleton className="h-11 w-28 self-end rounded-control" />
        </div>
      )}
      <LibraryCards />
    </SkeletonGroup>
  );
}
export function CaseListSkeleton() {
  return (
    <SkeletonGroup label="Loading cases…">
      <LibraryCards />
    </SkeletonGroup>
  );
}
function LibraryCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((key) => (
        <div
          key={key}
          className="flex flex-col gap-4 rounded-panel border border-border bg-muted p-6"
        >
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
export function CaseDetailSkeleton() {
  return (
    <SkeletonGroup
      label="Loading case overview…"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="overflow-hidden rounded-panel border border-border bg-muted">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="flex flex-col gap-4 border-b border-border p-6 last:border-0"
          >
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-8 w-48 rounded-control" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
