import { Skeleton } from "@/components/ui/skeleton";

export function RequestSkeleton() {
  return (
    <section
      className="flex flex-col gap-5"
      aria-label="Loading Wren chat"
      aria-busy="true"
    >
      <div className="flex justify-between gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex min-h-[36rem] flex-col gap-6 rounded-panel border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-control" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-20 w-full rounded-control" />
      </div>
    </section>
  );
}
