import { SkeletonGroup } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/workspace/page-header-skeleton";
import { RequestSkeleton } from "@/features/requests/request-skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading Wren chat…" className="flex flex-col gap-7">
      <PageHeaderSkeleton />
      <RequestSkeleton />
    </SkeletonGroup>
  );
}
