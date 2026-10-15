import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function RequestSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_310px]">
        <Card variant="soft">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-5 w-36" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Skeleton className="h-44 w-full rounded-control" />
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Separator />
            <Skeleton className="h-5 w-36" />
            <div className="grid gap-3 md:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full rounded-control" />
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="gap-4">
            <Skeleton className="h-11 w-36 rounded-control" />
            <Skeleton className="h-4 w-1/3" />
          </CardFooter>
        </Card>
        <div className="mx-auto flex w-full max-w-77.5 flex-col items-center gap-4">
          <Skeleton className="aspect-square w-full rounded-panel" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
      <Skeleton className="h-5 w-44" />
      <div className="grid gap-3.5 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex min-h-[138px] flex-col justify-between gap-4 rounded-card border border-border bg-muted p-4"
          >
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
