import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";

export function WorkspaceSidebar() {
  return (
    <aside className="flex shrink-0 flex-col justify-between rounded-workspace border border-line bg-surface p-5 shadow-panel lg:w-[270px]">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label="Rewoven home"
          >
            <Image src="/rewoven.svg" width={36} height={36} alt="" />
            <div>
              <span className="block font-heading text-[17px] leading-tight font-bold tracking-tight">
                Rewoven
              </span>
              <span className="block text-xs text-ink-muted">Team memory</span>
            </div>
          </Link>
          <button
            type="button"
            disabled
            aria-label="Collapse sidebar"
            className="hidden size-8 items-center justify-center rounded-lg text-ink-muted lg:flex"
          >
            <Icon name="collapse" className="size-5" />
          </button>
          <span className="rounded-full bg-surface-soft px-3 py-1 text-xs text-ink-muted lg:hidden">
            UI preview
          </span>
        </div>
        <nav
          aria-label="Main navigation"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1"
        >
          <Link
            href="/"
            aria-current="page"
            className="flex min-h-11 items-center gap-3.5 rounded-card bg-lime px-4 py-3 font-heading text-[13px] font-semibold"
          >
            <Icon name="request" />
            <span>New request</span>
          </Link>
          <button
            type="button"
            disabled
            className="flex min-h-11 items-center gap-3.5 rounded-card px-4 py-3 text-left font-heading text-[13px] font-medium text-ink-muted"
            title="Case library is not available in this UI preview"
          >
            <Icon name="library" />
            <span>Case library</span>
          </button>
          <button
            type="button"
            disabled
            className="flex min-h-11 items-center gap-3.5 rounded-card px-4 py-3 text-left font-heading text-[13px] font-medium text-ink-muted"
            title="Saved plans are not available in this UI preview"
          >
            <Icon name="bookmark" />
            <span>Saved plans</span>
          </button>
        </nav>
      </div>
      <div className="mt-6 hidden border-t border-line/60 pt-3 lg:block">
        <div className="relative overflow-hidden rounded-[20px] bg-charcoal p-4 text-white">
          <div
            aria-hidden="true"
            className="absolute -right-3 -bottom-3 size-16 rounded-full bg-white/5"
          />
          <div className="mb-3 flex items-center justify-between">
            <span className="flex size-7 items-center justify-center rounded-full bg-lime text-foreground">
              <Icon name="spark" className="size-4" />
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-lime uppercase">
              Preview
            </span>
          </div>
          <p className="font-heading text-[13px] font-bold">Demo session</p>
          <p className="mt-1 text-xs leading-snug text-white/70">
            Try a request using fictional examples.
          </p>
          <p className="mt-4 rounded-control bg-white/10 px-3 py-1.5 text-center text-xs">
            No sign-in required
          </p>
        </div>
      </div>
    </aside>
  );
}
