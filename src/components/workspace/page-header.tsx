import { ThemeToggle } from "@/components/workspace/theme-toggle";

export function PageHeader({
  section,
  title,
  description,
}: {
  section: string;
  title: string;
  description: string;
}) {
  return (
    <header className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2.5 font-heading text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-primary ring-4 ring-primary/20"
          />
          {section}
        </p>
        <ThemeToggle />
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="max-w-[840px] font-heading text-[30px] leading-[1.15] font-bold tracking-[-0.035em] md:text-[36px] xl:text-[42px]">
          {title}
        </h1>
        <p className="max-w-[700px] text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </header>
  );
}
