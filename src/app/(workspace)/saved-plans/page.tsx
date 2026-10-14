import { ArrowRightIcon, BookmarkIcon } from "lucide-react";
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
  path: "/saved-plans",
  title: "Saved plans",
  description:
    "Return to your team’s reuse plans. Saved plans preview for Rewoven.",
});

export default function SavedPlansPage() {
  return (
    <>
      <PageHeader
        section="Saved plans"
        title="Saved plans"
        description="Return to reuse plans and the evidence that shaped them."
      />
      <Empty className="min-h-[360px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookmarkIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Saved plans preview</EmptyTitle>
          <EmptyDescription>
            Saving and managing plans are not available in this preview. Start
            with a request to explore the workflow.
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
