"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, useState } from "react";
import { Icon } from "@/components/icon";
import { sidebarTransition } from "@/lib/motion";

export function WorkspaceSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [message, setMessage] = useState("");
  const reducedMotion = useReducedMotion();
  const labelClass = collapsed ? "lg:sr-only" : "";
  const navigationClass = `flex min-h-11 items-center gap-3.5 rounded-card px-4 py-3 text-left font-heading text-[13px] transition-colors duration-180 ease-interface ${collapsed ? "lg:justify-center lg:px-0" : ""}`;

  function showPreviewMessage(text: string) {
    setMessage(text);
    setCollapsed(false);
  }

  return (
    <motion.aside
      initial={false}
      style={{ "--sidebar-width": "270px" } as CSSProperties}
      animate={{ "--sidebar-width": collapsed ? "76px" : "270px" }}
      transition={reducedMotion ? { duration: 0 } : sidebarTransition}
      className={`flex shrink-0 flex-col justify-between rounded-workspace border border-line bg-surface p-5 shadow-panel lg:w-[var(--sidebar-width)] ${collapsed ? "lg:p-3" : ""}`}
    >
      <div className="flex flex-col gap-6">
        <div
          className={`flex items-center justify-between border-b border-line/60 pb-3 ${collapsed ? "lg:flex-col lg:gap-2" : ""}`}
        >
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label="Rewoven home"
          >
            <Image src="/rewoven.svg" width={36} height={36} alt="" />
            <div className={labelClass}>
              <span className="block font-heading text-[17px] leading-tight font-bold tracking-tight">
                Rewoven
              </span>
              <span className="block text-xs text-ink-muted">Team memory</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls="sidebar-navigation"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden size-9 items-center justify-center rounded-lg text-ink-muted transition-colors duration-180 ease-interface hover:bg-surface-hover hover:text-foreground lg:flex"
          >
            <Icon name={collapsed ? "expand" : "collapse"} className="size-5" />
          </button>
          <span className="rounded-full bg-surface-soft px-3 py-1 text-xs text-ink-muted lg:hidden">
            UI preview
          </span>
        </div>
        <nav
          id="sidebar-navigation"
          aria-label="Main navigation"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1"
        >
          <Link
            href="/"
            aria-current="page"
            title="New request"
            className={`${navigationClass} bg-lime font-semibold hover:bg-lime-hover`}
          >
            <Icon name="request" />
            <span className={labelClass}>New request</span>
          </Link>
          <button
            type="button"
            onClick={() =>
              showPreviewMessage(
                "Case library is not available in this UI preview.",
              )
            }
            className={`${navigationClass} font-medium text-ink-muted hover:bg-surface-hover hover:text-foreground`}
            title="Case library"
          >
            <Icon name="library" />
            <span className={labelClass}>Case library</span>
          </button>
          <button
            type="button"
            onClick={() =>
              showPreviewMessage(
                "Saved plans are not available in this UI preview.",
              )
            }
            className={`${navigationClass} font-medium text-ink-muted hover:bg-surface-hover hover:text-foreground`}
            title="Saved plans"
          >
            <Icon name="bookmark" />
            <span className={labelClass}>Saved plans</span>
          </button>
        </nav>
        <output
          className={
            message ? "text-xs leading-relaxed text-ink-muted" : "sr-only"
          }
        >
          {message}
        </output>
      </div>
      <div
        className={`mt-6 hidden border-t border-line/60 pt-3 ${collapsed ? "" : "lg:block"}`}
      >
        <div className="relative overflow-hidden rounded-[20px] bg-charcoal p-4 text-white">
          <div
            aria-hidden="true"
            className="absolute -right-3 -bottom-3 size-16 rounded-full bg-white/5"
          />
          <div className="mb-3 flex items-center justify-between">
            <span className="flex size-7 items-center justify-center rounded-full bg-lime text-foreground">
              <Icon name="spark" className="size-4" />
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-lime uppercase">
              Preview
            </span>
          </div>
          <p className="font-heading text-[13px] font-bold">Demo session</p>
          <p className="mt-1 text-xs leading-snug text-white/70">
            Try a request using fictional examples.
          </p>
          <p className="mt-4 rounded-control bg-white/10 px-3 py-1.5 text-center text-xs">
            No sign-in required
          </p>
        </div>
      </div>
    </motion.aside>
  );
}
