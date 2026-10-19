"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
import { parseStarter } from "@/features/onboarding/model";
import { WrenCompanion } from "@/features/requests/wren-companion";
import { QueryWorkspace } from "./query-workspace";
import { useWrenTransition } from "./use-wren-transition";
import { WrenSearchStage } from "./wren-search-stage";
export function QueryEntry() {
  const params = useSearchParams();
  const id = params.get("query");
  const caseId = params.get("case");
  const starter =
    !params.has("query") && !params.has("case")
      ? parseStarter(params.get("starter"))
      : null;
  const portrait = useRef<HTMLDivElement>(null);
  const { transition, begin, open, ready, loadFailed, fail } =
    useWrenTransition(id);
  const measure = useCallback(() => {
    const rect = portrait.current?.getBoundingClientRect();
    return rect
      ? {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }
      : null;
  }, []);
  const start = useCallback(() => begin(measure()), [begin, measure]);
  const failed = useCallback(() => fail(measure()), [fail, measure]);
  return (
    <>
      <div inert={Boolean(transition)} aria-busy={Boolean(transition)}>
        <QueryWorkspace
          key={id ?? caseId ?? "new"}
          id={id}
          initialCaseId={caseId}
          starter={starter}
          companion={
            <WrenCompanion
              imageRef={portrait}
              travelling={Boolean(transition)}
            />
          }
          onCreateStart={start}
          onCreated={open}
          onCreateError={failed}
          onReady={ready}
          onLoadError={loadFailed}
        />
      </div>
      {transition && <WrenSearchStage transition={transition} />}
    </>
  );
}
