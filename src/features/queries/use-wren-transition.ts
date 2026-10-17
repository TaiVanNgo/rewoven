"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWrenExitDelay, type WrenRect, wrenTiming } from "./wren-geometry";
import type { WrenTransition } from "./wren-search-stage";

type TransitionRun = {
  controller: AbortController;
  startedAt: number;
  queryId: string | null;
  opened: boolean;
  settling: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Transient presentation state; query IDs and API idempotency remain unchanged. */
export function useWrenTransition(queryId: string | null) {
  const [transition, setTransition] = useState<WrenTransition | null>(null);
  const run = useRef<TransitionRun | null>(null);
  const focusAfter = useRef<string | null>(null);

  const cancel = useCallback(() => {
    const current = run.current;
    if (!current) return;
    clearTimeout(current.timer);
    current.controller.abort();
    run.current = null;
    focusAfter.current = null;
    setTransition(null);
  }, []);

  useEffect(() => cancel, [cancel]);
  useEffect(() => {
    const current = run.current;
    if (!current) return;
    if (queryId && queryId === current.queryId) current.opened = true;
    else if (queryId || current.opened) cancel();
  }, [queryId, cancel]);

  useEffect(() => {
    if (transition || !focusAfter.current) return;
    const selector = focusAfter.current;
    focusAfter.current = null;
    // Do not steal focus if someone used the sidebar during the handoff.
    const active = document.activeElement;
    if (
      active !== document.body &&
      !document.getElementById("main-content")?.contains(active)
    )
      return;
    document
      .querySelector<HTMLElement>(selector)
      ?.focus({ preventScroll: true });
  }, [transition]);

  const begin = useCallback(
    (source: WrenRect | null) => {
      cancel();
      const controller = new AbortController();
      run.current = {
        controller,
        startedAt: performance.now(),
        queryId: null,
        opened: false,
        settling: false,
      };
      setTransition({ source, phase: "searching" });
      return controller.signal;
    },
    [cancel],
  );

  const open = useCallback((id: string) => {
    if (run.current) run.current.queryId = id;
  }, []);

  const settle = useCallback(
    (phase: "exiting" | "returning", selector: string, hold: boolean) => {
      const current = run.current;
      if (!current || current.settling) return;
      current.settling = true;
      const reduced = prefersReducedMotion();
      const finish = () => {
        if (run.current !== current) return;
        run.current = null;
        current.controller.abort();
        focusAfter.current = selector;
        setTransition(null);
      };
      const leave = () => {
        if (run.current !== current) return;
        if (reduced) return finish();
        setTransition((previous) => (previous ? { ...previous, phase } : null));
        current.timer = setTimeout(
          finish,
          1000 * (phase === "returning" ? wrenTiming.return : wrenTiming.exit),
        );
      };
      const delay = hold
        ? getWrenExitDelay(current.startedAt, performance.now(), reduced)
        : 0;
      if (delay) current.timer = setTimeout(leave, delay);
      else leave();
    },
    [],
  );

  const ready = useCallback(
    (id: string) => {
      if (run.current?.queryId === id)
        settle("exiting", "#query-workspace-title", true);
    },
    [settle],
  );
  const loadFailed = useCallback(
    (id: string) => {
      if (run.current?.queryId === id)
        settle("exiting", "[data-query-open-error]", false);
    },
    [settle],
  );
  const fail = useCallback(
    (source: WrenRect | null) => {
      if (!run.current) return;
      setTransition((previous) => (previous ? { ...previous, source } : null));
      settle("returning", "#wren-message", false);
    },
    [settle],
  );

  return { transition, begin, open, ready, loadFailed, fail };
}
