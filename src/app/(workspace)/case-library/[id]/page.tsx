import type { Metadata } from "next";
import { Suspense } from "react";
import { CasePage } from "@/features/cases/case-page";
import { CaseDetailSkeleton } from "@/features/cases/case-skeleton";
import "@/features/cases/case-library-layout.css";
import { createPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    ...createPageMetadata({
      title: "Case details",
      description:
        "Read a project overview and inspect its supporting sources.",
      path: `/case-library/${id}`,
    }),
    robots: { index: false, follow: false },
  };
}
export default function CaseDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<CaseDetailSkeleton />}>
      <CaseContent params={params} />
    </Suspense>
  );
}
async function CaseContent({ params }: Props) {
  const { id } = await params;
  return <CasePage id={id} />;
}
