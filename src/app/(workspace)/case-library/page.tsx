import { ArchiveIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/workspace/page-header";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  path: "/case-library",
  title: "Case library",
  description:
    "Explore past work and follow its sources. Case library preview for Rewoven.",
});

export default function CaseLibraryPage() {
  return (
    <>
      <PageHeader
        section="Case library"
        title="Case library"
        description="Explore past projects, decisions, and the sources behind them."
      />
      <Empty className="min-h-[360px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ArchiveIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Case library preview</EmptyTitle>
          <EmptyDescription>
            Case browsing and uploads are not available in this preview. You can
            try a sample request in the meantime.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href="/" className={buttonVariants()}>
            Start a new request
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </EmptyContent>
      </Empty>
    </>
  );
}
