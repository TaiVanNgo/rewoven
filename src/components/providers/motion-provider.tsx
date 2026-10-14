"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { interactionTransition } from "@/lib/motion";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={interactionTransition}>
      {children}
    </MotionConfig>
  );
}
