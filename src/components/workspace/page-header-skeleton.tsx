import { Skeleton } from "@/components/ui/skeleton";

export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="size-7 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-3/4 max-w-[700px] md:h-12" />
        <Skeleton className="h-6 w-full max-w-[600px]" />
      </div>
    </div>
  );
}
