import type * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[150px] w-full min-w-0 resize-y rounded-card border border-input bg-card p-4 text-base leading-relaxed transition-colors duration-180 ease-interface placeholder:text-muted-foreground focus:border-ring disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
