import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 font-heading text-[13px] font-semibold whitespace-nowrap transition-colors duration-180 ease-interface select-none disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "rounded-control bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "rounded-control border border-border bg-card hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent",
        secondary:
          "rounded-control bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "rounded-control text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        companion:
          "rounded-control text-xs text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "rounded-control bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "rounded-control text-foreground underline-offset-4 hover:underline",
        navigation:
          "justify-start rounded-card text-muted-foreground font-medium hover:bg-accent hover:text-foreground",
        "navigation-active":
          "justify-start rounded-card bg-primary text-primary-foreground hover:bg-primary-hover",
        upload:
          "min-h-32 w-full min-w-0 flex-col gap-2 rounded-card border-2 border-dashed border-border bg-muted p-5 text-center whitespace-normal wrap-anywhere hover:border-ring hover:bg-card",
        case: "h-auto min-w-0 flex-col items-stretch justify-start gap-3 rounded-card border border-border bg-card p-4 text-left whitespace-normal hover:border-ring",
        "case-active":
          "h-auto min-w-0 flex-col items-stretch justify-start gap-3 rounded-card border-2 border-foreground bg-card p-[15px] text-left whitespace-normal",
        sample:
          "group min-h-[138px] flex-col items-stretch justify-between gap-4 rounded-card border border-border bg-muted text-left whitespace-normal hover:border-ring hover:bg-card",
      },
      size: {
        default: "min-h-11 px-5 py-3",
        navigation: "min-h-11 gap-3.5 px-4 py-3 [&_svg]:size-5",
        sample: "h-auto p-4",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-11",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
