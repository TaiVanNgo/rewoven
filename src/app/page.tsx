import Image from "next/image";
import { Icon } from "@/components/icon";
import { PreviewAction } from "@/components/preview-action";
import { RequestComposer } from "@/components/request-composer";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({ path: "/", title: "New request" });

export default function Home() {
  return (
    <div className="p-4 md:p-shell">
      <a
        href="#main-content"
        className="sr-only z-10 rounded-control bg-lime px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <div className="mx-auto flex min-h-[calc(100dvh-56px)] max-w-[1540px] flex-col items-stretch gap-gutter lg:flex-row">
        <WorkspaceSidebar />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-w-0 flex-1 flex-col justify-between rounded-workspace border border-line bg-surface p-5 shadow-panel md:p-9"
        >
          <div className="space-y-7">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2.5 font-heading text-[11px] font-bold tracking-wider text-ink-muted uppercase">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-lime ring-4 ring-lime/20"
                />
                New request
              </p>
              <span className="flex items-center gap-2 rounded-full border border-line bg-surface-soft px-3 py-1.5 text-xs text-ink-muted">
                <Icon name="chip" className="size-3.5" />
                Archivist v2.4
              </span>
            </div>
            <header className="space-y-3">
              <h1 className="max-w-[840px] font-heading text-[30px] leading-[1.15] font-bold tracking-[-0.035em] md:text-[36px] xl:text-[42px]">
                What is your team working on next?
              </h1>
              <p className="max-w-[700px] text-base leading-relaxed text-ink-muted">
                Describe the request. Rewoven will find relevant past work and
                show what you can reuse.
              </p>
            </header>
            <RequestComposer
              companion={
                <aside
                  aria-label="Meet Wren"
                  className="mx-auto flex w-full max-w-[310px] flex-col items-center"
                >
                  <div className="w-full rounded-panel border border-line bg-surface-soft p-3.5 shadow-panel">
                    <Image
                      src="/images/wren.jpg"
                      width={512}
                      height={512}
                      preload
                      sizes="(min-width: 1280px) 280px, (max-width: 389px) 240px, 280px"
                      alt="Wren, the team archivist, holding a stack of case folders"
                      className="block h-auto w-full rounded-card"
                    />
                  </div>
                  <div className="mt-4 text-center">
                    <h2 className="font-heading text-sm font-bold">
                      Wren, the team archivist
                    </h2>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      Find past work. Follow the evidence.
                    </p>
                    <PreviewAction />
                  </div>
                </aside>
              }
            />
          </div>
          <footer className="mt-6 border-t border-line/60 pt-6">
            <p className="text-center text-xs leading-relaxed text-ink-muted">
              UI preview with fictional samples. Requests are kept only while
              this page is open.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
