import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-[42px] w-full min-w-0 rounded-control border border-input bg-card px-3.5 py-2 text-base transition-colors duration-180 ease-interface placeholder:text-muted-foreground focus:border-ring disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
