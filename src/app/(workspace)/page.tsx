import { Suspense } from "react";
import { QueryEntry } from "@/features/queries/query-entry";
import { RequestSkeleton } from "@/features/requests/request-skeleton";
import "@/features/queries/query-workspace.css";
import "@/features/requests/request-page.css";
import { createPageMetadata } from "@/lib/seo";
export const metadata = createPageMetadata({ path: "/", title: "Ask Wren" });
export default function Home() {
  return (
    <Suspense fallback={<RequestSkeleton />}>
      <QueryEntry />
    </Suspense>
  );
}
