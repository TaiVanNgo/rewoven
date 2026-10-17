import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { QueryEntry } from "@/features/queries/query-entry";
import { RequestSkeleton } from "@/features/requests/request-skeleton";
import "@/features/queries/query-workspace.css";
import "@/features/requests/request-page.css";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({ path: "/", title: "New request" });

export default function Home() {
  return (
    <Suspense fallback={<RequestSkeleton />}>
      <QueryEntry
        companion={
          <aside
            aria-label="Meet Wren"
            className="request-companion mx-auto flex w-full max-w-77.5 flex-col items-center"
          >
            <div className="w-full rounded-panel border border-line bg-surface-soft p-3.5 shadow-panel">
              <Image
                src="/images/wren.png"
                width={512}
                height={512}
                preload
                sizes="(min-width: 1280px) and (max-height: 1120px) 190px, (min-width: 1280px) 280px, (max-width: 389px) 240px, 280px"
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
              <Link
                href="/case-library"
                className={buttonVariants({ variant: "companion" })}
              >
                Browse the case library
                <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
              </Link>
            </div>
          </aside>
        }
      />
    </Suspense>
  );
}
