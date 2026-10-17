import { PageHeader } from "@/components/workspace/page-header";
import { PlanEditor } from "@/features/plans/plan-editor";
import { createPageMetadata } from "@/lib/seo";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    ...createPageMetadata({
      path: `/saved-plans/${id}`,
      title: "Review your reuse plan",
      description:
        "Edit, save and export a reuse plan backed by original project evidence.",
    }),
    robots: { index: false, follow: false },
  };
}
export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        section="Saved plans"
        title="Shape your next plan"
        description="Review the request, adapt the draft, and keep the evidence close."
      />
      <PlanEditor key={id} id={id} />
    </>
  );
}
