import { PageHeader } from "@/components/workspace/page-header";
import { CaseLibrary } from "@/features/cases/case-library";
import "@/features/cases/case-library-layout.css";
import { createPageMetadata } from "@/lib/seo";
export const metadata = createPageMetadata({
  path: "/case-library",
  title: "Case library",
  description:
    "Explore past work and inspect the original sources behind each case.",
});
export default function CaseLibraryPage() {
  return (
    <div className="case-library-page">
      <PageHeader
        section="Case library"
        title="Case library"
        description="Past work, with the original sources."
      />
      <CaseLibrary />
    </div>
  );
}
