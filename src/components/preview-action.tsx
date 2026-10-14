import { Icon } from "@/components/icon";

export function PreviewAction() {
  return (
    <button
      type="button"
      disabled
      className="inline-flex min-h-11 items-center gap-2 font-heading text-xs font-semibold"
      title="Case library is not available in this UI preview"
    >
      Browse the case library
      <Icon name="arrow" className="size-4" />
    </button>
  );
}
