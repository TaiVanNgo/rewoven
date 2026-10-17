"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  getWrenStage,
  isWrenVisible,
  type WrenRect,
  wrenTiming,
} from "./wren-geometry";
import "./wren-search-stage.css";

export type WrenTransition = {
  source: WrenRect | null;
  phase: "searching" | "exiting" | "returning";
};

function measureStage() {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const workspace = document
    .getElementById("main-content")
    ?.getBoundingClientRect() ?? {
    left: 0,
    top: 0,
    ...viewport,
  };
  const stage = getWrenStage(workspace, viewport);
  return stage.width > 0
    ? stage
    : getWrenStage({ left: 0, top: 0, ...viewport }, viewport);
}

/** An ornament, not a claim about actual files, matches, or retrieval progress. */
function SearchDocuments() {
  return (
    <div className="wren-search-documents" aria-hidden="true">
      <div className="wren-search-glow" />
      <div className="wren-search-ring" />
      <div className="wren-search-ring wren-search-ring-delayed" />
      <svg
        className="wren-search-threads"
        viewBox="0 0 210 190"
        fill="none"
        aria-hidden="true"
      >
        <path d="M 52 80 C 65 20, 85 10, 125 26" />
        <path d="M 52 80 C 40 15, 60 -5, 92 8" />
        <circle cx="125" cy="26" r="3" />
        <circle cx="92" cy="8" r="2.5" />
      </svg>
      {["back", "middle", "front"].map((layer) => (
        <div
          key={layer}
          className={`wren-search-document wren-search-document-${layer}`}
        >
          <div className="wren-search-document-tab" />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export function WrenSearchStage({
  transition,
}: {
  transition: WrenTransition;
}) {
  const reducedMotion = useReducedMotion();
  const [target, setTarget] = useState(measureStage);
  const [origin] = useState(() => {
    const { source } = transition;
    return source &&
      isWrenVisible(source, {
        width: window.innerWidth,
        height: window.innerHeight,
      })
      ? source
      : null;
  });
  useEffect(() => {
    const update = () => setTarget(measureStage());
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    const workspace = document.getElementById("main-content");
    const observer = new ResizeObserver(update);
    if (workspace) observer.observe(workspace);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, []);

  const returning = transition.phase === "returning";
  const destination =
    returning &&
    transition.source &&
    isWrenVisible(transition.source, {
      width: window.innerWidth,
      height: window.innerHeight,
    })
      ? transition.source
      : target;
  const leaving = transition.phase !== "searching";
  const duration = reducedMotion
    ? 0
    : returning
      ? wrenTiming.return
      : wrenTiming.travel;
  return (
    <div className="wren-search-overlay" data-phase={transition.phase}>
      <motion.div
        className="wren-search-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.3 }}
      />
      <motion.div
        className="wren-search-position"
        initial={
          reducedMotion
            ? false
            : {
                x: origin?.left ?? target.left,
                y: origin?.top ?? target.top,
                scale: origin ? origin.width / target.width : 0.98,
                opacity: origin ? 1 : 0,
              }
        }
        animate={{
          x: destination.left,
          y: destination.top,
          scale: destination.width / target.width,
          opacity:
            transition.phase === "exiting" ||
            (returning && destination === target)
              ? 0
              : 1,
        }}
        style={{
          width: target.width,
          height: target.height,
          originX: 0,
          originY: 0,
        }}
        transition={{
          duration,
          ease: [0.22, 1, 0.36, 1],
          opacity: { duration: reducedMotion ? 0 : wrenTiming.exit },
        }}
      >
        <div className="wren-search-character" aria-hidden="true">
          <Image
            src="/images/wren.png"
            alt=""
            width={1024}
            height={1024}
            sizes="440px"
            className="wren-search-image"
          />
          <SearchDocuments />
        </div>
        <motion.p
          className="wren-search-label"
          role="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: leaving ? 0 : 1 }}
          transition={{
            delay: leaving || reducedMotion ? 0 : wrenTiming.travel,
            duration: reducedMotion ? 0 : 0.2,
          }}
        >
          Wren is opening your query…
        </motion.p>
      </motion.div>
    </div>
  );
}
