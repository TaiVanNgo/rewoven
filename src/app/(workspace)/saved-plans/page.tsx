import { PageHeader } from "@/components/workspace/page-header";
import { SavedPlans } from "@/features/plans/saved-plans";
import { createPageMetadata } from "@/lib/seo";
export const metadata = createPageMetadata({
  path: "/saved-plans",
  title: "Saved plans",
  description:
    "Return to your reviewed reuse plans and their original evidence.",
});
export default function SavedPlansPage() {
  return (
    <>
      <PageHeader
        section="Saved plans"
        title="Saved plans"
        description="Your reviewed drafts, ready for the next conversation."
      />
      <SavedPlans />
    </>
  );
}
