import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-foreground/10 motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

// Keep the announcement outside the busy, decorative placeholders.
function SkeletonGroup({
  label,
  children,
  ...props
}: React.ComponentProps<"div"> & { label: string }) {
  return (
    <>
      <output className="sr-only" aria-live="polite">
        {label}
      </output>
      <div
        data-slot="skeleton-group"
        aria-busy="true"
        aria-hidden="true"
        {...props}
      >
        {children}
      </div>
    </>
  );
}

export { Skeleton, SkeletonGroup };
