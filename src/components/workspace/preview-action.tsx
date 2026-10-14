"use client";

import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PreviewAction() {
  const [showMessage, setShowMessage] = useState(false);
  return (
    <div>
      <Button
        type="button"
        onClick={() => setShowMessage(true)}
        variant="ghost"
      >
        Browse the case library
        <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
      </Button>
      <output className="block text-xs leading-relaxed text-ink-muted">
        {showMessage ? "Case library is not available in this UI preview." : ""}
      </output>
    </div>
  );
}
