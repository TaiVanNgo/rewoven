import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

export function CaseLibrarySkeleton({
  withToolbar = false,
}: {
  withToolbar?: boolean;
}) {
  return (
    <SkeletonGroup
      label="Loading case library…"
      className="case-library-skeleton flex flex-col gap-5"
    >
      {withToolbar && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-11 w-full rounded-control" />
          </div>
          <Skeleton className="h-11 w-28 rounded-control" />
        </div>
      )}
      <div className="case-library-grid grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.8fr)]">
        <CaseListPlaceholder />
        <CaseDetailPlaceholder />
      </div>
    </SkeletonGroup>
  );
}

export function CaseListSkeleton() {
  return (
    <SkeletonGroup label="Searching cases…">
      <CaseListPlaceholder />
    </SkeletonGroup>
  );
}

export function CaseDetailSkeleton() {
  return (
    <SkeletonGroup id="case-detail" label="Loading case details and sources…">
      <CaseDetailPlaceholder />
    </SkeletonGroup>
  );
}

function CaseListPlaceholder() {
  return (
    <div className="case-list flex min-w-0 flex-col gap-3 rounded-panel border border-border bg-muted p-4">
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="case-list-scroll flex max-h-[680px] flex-col gap-3 overflow-hidden p-1">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
          >
            <div className="flex justify-between gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Separator />
            <div className="flex justify-between gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaseDetailPlaceholder() {
  return (
    <div className="case-content flex min-w-0 flex-col gap-5">
      <Card variant="soft">
        <CardHeader>
          <div className="mb-2 flex gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <CardTitle>
            <Skeleton className="h-7 w-2/3" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-16 w-full rounded-control" />
        </CardContent>
      </Card>
      <Card variant="soft">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-5 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-44 rounded-control" />
            <Skeleton className="h-8 w-36 rounded-control" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-11 w-40 rounded-control" />
          </div>
          <Separator />
          <div className="flex justify-between gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex min-h-40 flex-col gap-3 rounded-card border border-border bg-card p-5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
        <CardFooter>
          <Skeleton className="h-3 w-4/5" />
        </CardFooter>
      </Card>
    </div>
  );
}
