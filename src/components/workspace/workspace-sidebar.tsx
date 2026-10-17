"use client";

import {
  ArchiveIcon,
  BookmarkIcon,
  FilePlus2Icon,
  LightbulbIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BrandLogo } from "@/components/workspace/brand-logo";
import { RecentQueries } from "@/features/queries/query-history";
import { useRequestDraft } from "@/features/requests/request-draft";
import { sidebarTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function WorkspaceSidebar() {
  const { updateDraft } = useRequestDraft();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const labelClass = collapsed ? "lg:sr-only" : undefined;
  const navigationLayout = cn(
    "w-full",
    collapsed && "lg:justify-center lg:gap-0 lg:px-0",
  );

  return (
    <motion.aside
      initial={false}
      style={{ "--sidebar-width": "270px" } as CSSProperties}
      animate={{ "--sidebar-width": collapsed ? "76px" : "270px" }}
      transition={reducedMotion ? { duration: 0 } : sidebarTransition}
      className={cn(
        "flex shrink-0 flex-col justify-between rounded-workspace border border-border bg-card p-5 shadow-panel lg:sticky lg:top-shell lg:h-[calc(100dvh-56px)] lg:w-[var(--sidebar-width)] lg:self-start lg:overflow-y-auto",
        collapsed && "lg:p-3",
      )}
    >
      <div className="flex shrink-0 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "flex items-center justify-between",
              collapsed && "lg:flex-col lg:gap-2",
            )}
          >
            <Link
              href="/"
              className="flex min-w-0 items-center gap-3"
              aria-label="Rewoven home"
            >
              <BrandLogo />
              <div className={labelClass}>
                <span className="block font-heading text-[17px] leading-tight font-bold tracking-tight">
                  Rewoven
                </span>
                <span className="block text-xs text-muted-foreground">
                  Team memory
                </span>
              </div>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              aria-controls="sidebar-navigation"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden lg:inline-flex"
            >
              {collapsed ? (
                <PanelLeftOpenIcon aria-hidden="true" />
              ) : (
                <PanelLeftCloseIcon aria-hidden="true" />
              )}
            </Button>
            <Badge variant="outline" className="lg:hidden">
              UI preview
            </Badge>
          </div>
          <Separator />
        </div>
        <nav
          id="sidebar-navigation"
          aria-label="Main navigation"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1"
        >
          {[
            { href: "/", label: "New request", icon: FilePlus2Icon },
            { href: "/case-library", label: "Case library", icon: ArchiveIcon },
            { href: "/saved-plans", label: "Saved plans", icon: BookmarkIcon },
          ].map(({ href, label, icon: NavigationIcon }) => (
            <Link
              key={href}
              href={href}
              onClick={
                href === "/"
                  ? () =>
                      updateDraft({
                        request: "",
                        deadline: "",
                        technology: "",
                        capabilities: "",
                      })
                  : undefined
              }
              aria-current={pathname === href ? "page" : undefined}
              title={label}
              className={cn(
                buttonVariants({
                  variant:
                    pathname === href ? "navigation-active" : "navigation",
                  size: "navigation",
                }),
                navigationLayout,
              )}
            >
              <NavigationIcon aria-hidden="true" />
              <span className={labelClass}>{label}</span>
            </Link>
          ))}
        </nav>
        <RecentQueries collapsed={collapsed} />
      </div>
      <div
        className={cn(
          "mt-6 hidden shrink-0 flex-col gap-3",
          !collapsed && "lg:flex",
        )}
      >
        <Separator />
        <Card variant="inverse" size="sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <LightbulbIcon aria-hidden="true" className="size-4" />
            </span>
            <Badge variant="preview">Preview</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <CardTitle>Demo session</CardTitle>
            <CardDescription>
              Explore fictional cases or add your own sources.
            </CardDescription>
          </CardContent>
          <CardFooter>
            <p className="w-full text-center text-xs">No sign-in required</p>
          </CardFooter>
        </Card>
      </div>
    </motion.aside>
  );
}
