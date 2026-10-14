"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

export function PreviewAction() {
  const [showMessage, setShowMessage] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setShowMessage(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 font-heading text-xs font-semibold transition-colors duration-180 ease-interface hover:bg-lime-soft"
      >
        Browse the case library
        <Icon name="arrow" className="size-4" />
      </button>
      <output className="block text-xs leading-relaxed text-ink-muted">
        {showMessage ? "Case library is not available in this UI preview." : ""}
      </output>
    </div>
  );
}
