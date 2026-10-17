"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/workspace/page-header";
import { caseApi } from "@/features/cases/api-client";
import type { CaseRecord } from "@/features/cases/types";
import { RequestComposer } from "@/features/requests/request-composer";
import {
  type RequestDraft,
  useRequestDraft,
} from "@/features/requests/request-draft";
import { WrenCompanion } from "@/features/requests/wren-companion";
import { useQueryHistory } from "./query-history";
import { QueryWorkspace } from "./query-workspace";
import type { QueryConversation } from "./types";
import { useWrenTransition } from "./use-wren-transition";
import { WrenSearchStage } from "./wren-search-stage";

export function QueryEntry() {
  const params = useSearchParams();
  const router = useRouter();
  const queryId = params.get("query");
  const caseId = params.get("case");
  const editId = params.get("edit");
  const { updateDraft } = useRequestDraft();
  const { refresh } = useQueryHistory();
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [error, setError] = useState("");
  const [resolvedCase, setResolvedCase] = useState<string | null>(null);
  const submission = useRef<{ id: string; draft: string } | null>(null);
  const portrait = useRef<HTMLDivElement>(null);
  const { transition, begin, open, ready, loadFailed, fail } =
    useWrenTransition(queryId);
  useEffect(() => {
    if (!caseId || queryId) return;
    const controller = new AbortController();
    caseApi("/api/demo-session", { method: "POST", signal: controller.signal })
      .then(() =>
        caseApi<{ case: CaseRecord }>(`/api/cases/${caseId}`, {
          signal: controller.signal,
        }),
      )
      .then(async ({ case: record }) => {
        const edited = editId
          ? (
              await caseApi<{ query: QueryConversation }>(
                `/api/queries/${editId}`,
                { signal: controller.signal },
              )
            ).query.request
          : null;
        if (controller.signal.aborted) return;
        setSelectedCase(record);
        setResolvedCase(caseId);
        setError("");
        updateDraft(
          edited ?? {
            request: `What should I know about ${record.title}, its recorded outcome, and its caveats?`,
            deadline: "",
            technology: "",
            capabilities: "",
          },
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.message);
          setResolvedCase(caseId);
          setSelectedCase(null);
        }
      });
    return () => controller.abort();
  }, [caseId, queryId, editId, updateDraft]);
  function measurePortrait() {
    const rect = portrait.current?.getBoundingClientRect();
    return rect
      ? {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }
      : null;
  }
  async function submit(draft: RequestDraft) {
    if (transition) return;
    const key = JSON.stringify({ ...draft, caseId });
    if (submission.current?.draft !== key)
      submission.current = { id: crypto.randomUUID(), draft: key };
    const signal = begin(measurePortrait());
    try {
      await caseApi("/api/demo-session", { method: "POST", signal });
      const { query } = await caseApi<{ query: QueryConversation }>(
        "/api/queries",
        {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            requestKey: submission.current.id,
            caseId,
          }),
        },
      );
      if (signal.aborted) return;
      void refresh();
      submission.current = null;
      open(query.id);
      router.push(`/?query=${query.id}`);
    } catch (error) {
      if (signal.aborted) return;
      fail(measurePortrait());
      throw error;
    }
  }
  return (
    <>
      <div inert={Boolean(transition)} aria-busy={Boolean(transition)}>
        {queryId ? (
          <QueryWorkspace
            key={queryId}
            id={queryId}
            onReady={ready}
            onLoadError={loadFailed}
          />
        ) : (
          <div className="request-page">
            <PageHeader
              section="New request"
              title="What is your team working on next?"
              description="Describe the request. Ask Wren to find relevant past work, compare it, and follow the evidence."
            />
            {caseId && (
              <Alert>
                <AlertTitle>
                  {resolvedCase !== caseId
                    ? "Opening case…"
                    : (selectedCase?.title ?? "Case unavailable")}
                </AlertTitle>
                <AlertDescription>
                  {error ||
                    "Your question will focus on this case. You can search the whole library from chat."}
                  <Link href="/" className="ml-2 underline">
                    Search all cases instead
                  </Link>
                </AlertDescription>
              </Alert>
            )}
            {(!caseId || (resolvedCase === caseId && selectedCase)) && (
              <RequestComposer
                companion={
                  <WrenCompanion
                    imageRef={portrait}
                    travelling={Boolean(transition)}
                  />
                }
                onSubmit={submit}
              />
            )}
          </div>
        )}
      </div>
      {transition && <WrenSearchStage transition={transition} />}
    </>
  );
}
