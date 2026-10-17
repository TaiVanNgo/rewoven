"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import { CitationDialog } from "./citation-dialog";
import { type CitationReference, citationHref } from "./types";

type OpenCitation = (
  reference: CitationReference,
  trigger: HTMLElement,
) => void;
const CitationContext = createContext<OpenCitation | null>(null);

export function CitationProvider({ children }: { children: ReactNode }) {
  const [reference, setReference] = useState<CitationReference | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  return (
    <CitationContext.Provider
      value={(next, element) => {
        trigger.current = element;
        setReference(next);
      }}
    >
      {children}
      <CitationDialog
        reference={reference}
        trigger={trigger}
        onClose={() => setReference(null)}
      />
    </CitationContext.Provider>
  );
}

export function CitationMarker({
  reference,
  number,
  onOpen,
  href,
}: {
  reference: CitationReference;
  number: number;
  onOpen?: OpenCitation;
  href?: string;
}) {
  const open = useContext(CitationContext);
  const label = `Source ${number}: ${reference.sourceTitle}${reference.page ? `, page ${reference.page}` : ""}, ${reference.caseTitle}`;
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={250}
          closeDelay={120}
          render={
            <Link
              href={href ?? citationHref(reference)}
              className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-md bg-knowledge px-1.5 align-baseline text-xs font-semibold text-knowledge-ink no-underline ring-offset-background hover:ring-1 hover:ring-knowledge-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={label}
              aria-haspopup="dialog"
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                )
                  return;
                const handler = onOpen ?? open;
                if (handler) {
                  event.preventDefault();
                  handler(reference, event.currentTarget);
                }
              }}
            />
          }
        >
          [{number}]
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="top" align="start" sideOffset={8}>
            <Tooltip.Popup
              role="tooltip"
              className="max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-4 text-sm text-popover-foreground shadow-lg"
            >
              <p className="text-xs text-muted-foreground">
                {reference.caseTitle}
              </p>
              <p className="mt-1 font-semibold wrap-anywhere">
                {reference.sourceTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {reference.version === null
                  ? "Source version unverified"
                  : `Version ${reference.version}`}
                {reference.page
                  ? ` · Physical page ${reference.page}`
                  : " · Text source"}
              </p>
              {reference.quote && (
                <p className="mt-3 line-clamp-5 border-l-2 border-knowledge-ink pl-3 leading-relaxed wrap-anywhere">
                  {reference.quote.slice(0, 500)}
                  {reference.quote.length > 500 ? "…" : ""}
                </p>
              )}
              {reference.stale && (
                <p className="mt-2 text-xs text-caution-foreground">
                  Saved reference · source may have changed
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Open to inspect the source
              </p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
