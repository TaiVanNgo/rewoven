"use client";

import { motion } from "motion/react";
import { useState } from "react";

export function MotionDemo() {
  const [turns, setTurns] = useState(0);

  return (
    <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-foreground/15 p-6">
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ rotate: turns * 360 }}
        className="size-10 rounded-xl bg-foreground"
      />
      <div className="space-y-3">
        <p className="font-medium">Motion is ready.</p>
        <motion.button
          type="button"
          onClick={() => setTurns((current) => current + 1)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="cursor-pointer rounded-lg border border-foreground/20 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
        >
          Replay animation
        </motion.button>
      </div>
    </div>
  );
}
