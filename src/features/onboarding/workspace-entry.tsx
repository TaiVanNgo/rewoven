"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useRequestDraft } from "@/features/requests/request-draft";
import { needsOnboarding } from "./model";
import { useOnboarding } from "./onboarding-provider";

export function WorkspaceEntry({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { dismissed, rememberWorkspace } = useOnboarding();
  const { draft } = useRequestDraft();
  const redirect = needsOnboarding(
    pathname,
    new URLSearchParams(params.toString()),
    dismissed === true,
    Object.values(draft).some(Boolean),
  );

  useEffect(() => {
    rememberWorkspace(`${pathname}${params.size ? `?${params}` : ""}`);
    if (dismissed !== null && redirect) router.replace("/onboarding");
  }, [dismissed, pathname, params, redirect, rememberWorkspace, router]);

  return (
    <>
      {redirect && (
        <output className="m-auto p-8 text-sm text-muted-foreground">
          Opening Rewoven…
        </output>
      )}
      {/* Keep the route rendered for Next.js instant-navigation validation.
          Hidden prevents a workspace flash before the browser preference loads. */}
      <div hidden={redirect}>{children}</div>
    </>
  );
}
