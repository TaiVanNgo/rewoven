"use client";

import {
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export function useQueryFileDrop({
  disabled,
  onFiles,
}: {
  disabled: boolean;
  onFiles: (files: File[]) => void;
}) {
  const depth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const reset = useCallback(() => {
    depth.current = 0;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (disabled) reset();
  }, [disabled, reset]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") reset();
    };
    // External file drags can end outside this workspace or browser window.
    window.addEventListener("drop", reset, true);
    window.addEventListener("dragend", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("drop", reset, true);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("blur", reset);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [reset]);

  return {
    isDragging: isDragging && !disabled,
    dropHandlers: {
      onDragEnter(event: DragEvent<HTMLDivElement>) {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        if (disabled) return;
        depth.current += 1;
        setIsDragging(true);
      },
      onDragOver(event: DragEvent<HTMLDivElement>) {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      },
      onDragLeave(event: DragEvent<HTMLDivElement>) {
        if (!depth.current) return;
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next)) {
          reset();
          return;
        }
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) reset();
      },
      onDrop(event: DragEvent<HTMLDivElement>) {
        if (
          !event.dataTransfer.types.includes("Files") &&
          !event.dataTransfer.files.length
        )
          return;
        event.preventDefault();
        reset();
        if (!disabled && event.dataTransfer.files.length)
          onFiles(Array.from(event.dataTransfer.files));
      },
    },
  };
}
