import { ApiError, apiError } from "@/features/cases/server/http";
import { requireSession } from "@/features/cases/server/session";
import { exportMarkdown } from "@/features/plans/content";
import { planDetail } from "@/features/plans/server/repository";
import { site } from "@/lib/site";
export async function GET(
  request: Request,
  context: RouteContext<"/api/plans/[id]/export">,
) {
  try {
    const plan = await planDetail(
      (await context.params).id,
      (await requireSession()).id,
    );
    if (!plan.saved_at)
      throw new ApiError(409, "Save this plan before exporting.");
    const filename =
      (plan.saved_title ?? plan.title)
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9-]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || "reuse-plan";
    return new Response(
      exportMarkdown(plan, site.url?.origin ?? new URL(request.url).origin),
      {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.md"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
