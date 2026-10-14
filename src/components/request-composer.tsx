"use client";

import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { requestSamples } from "@/lib/request-samples";

export function RequestComposer({ companion }: { companion: ReactNode }) {
  const [request, setRequest] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reducedMotion = useReducedMotion();
  const canSubmit = request.trim().length > 0;

  function loadSample(sample: (typeof requestSamples)[number]) {
    setRequest(`[${sample.title}]\n${sample.description}`);
    setSubmitted(false);
    textareaRef.current?.focus({ preventScroll: true });
    textareaRef.current?.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  return (
    <div className="space-y-9">
      <div className="grid grid-cols-1 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_310px]">
        <form
          className="min-w-0 rounded-panel border border-line bg-surface-soft p-5 shadow-panel md:p-7"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) setSubmitted(true);
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <label htmlFor="request" className="font-heading text-sm font-bold">
              Describe the request
            </label>
            <span className="rounded-full bg-lime px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
              Primary
            </span>
          </div>
          <textarea
            id="request"
            name="request"
            rows={5}
            maxLength={10000}
            ref={textareaRef}
            value={request}
            onChange={(event) => {
              setRequest(event.target.value.slice(0, 10000));
              setSubmitted(false);
            }}
            className="field min-h-[150px] resize-y rounded-card p-4"
            placeholder="What needs to be built, who is it for, and what should it do?"
            aria-describedby="request-hint request-counter"
          />
          <div className="mt-3 flex items-start justify-between gap-4 text-xs text-ink-muted">
            <p
              id="request-hint"
              className="flex max-w-[340px] items-start gap-1.5 leading-snug"
            >
              <Icon name="info" className="mt-0.5 size-3.5" />
              Plain language is fine. Mention architectural constraints or
              target teams.
            </p>
            <span
              id="request-counter"
              className="shrink-0 font-mono text-[11px]"
            >
              {request.length.toLocaleString("en-US")} / 10,000
            </span>
          </div>
          <fieldset className="mt-5 border-t border-line pt-4">
            <legend className="float-left mb-3 w-full font-heading text-xs font-bold">
              Optional constraints
            </legend>
            <div className="clear-both grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label
                  htmlFor="deadline"
                  className="mb-1.5 block text-xs text-ink-muted"
                >
                  Deadline
                </label>
                <input
                  id="deadline"
                  name="deadline"
                  type="text"
                  className="field"
                  placeholder="e.g. 6 weeks"
                />
              </div>
              <div>
                <label
                  htmlFor="technology"
                  className="mb-1.5 block text-xs text-ink-muted"
                >
                  Technology
                </label>
                <input
                  id="technology"
                  name="technology"
                  type="text"
                  className="field"
                  placeholder="e.g. React, Node.js"
                />
              </div>
              <div>
                <label
                  htmlFor="capabilities"
                  className="mb-1.5 block text-xs text-ink-muted"
                >
                  Required capabilities
                </label>
                <input
                  id="capabilities"
                  name="capabilities"
                  type="text"
                  className="field"
                  placeholder="e.g. Two approval stages"
                />
              </div>
            </div>
          </fieldset>
          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
            <motion.button
              type="submit"
              disabled={!canSubmit}
              className="action"
              initial={false}
              whileTap={
                reducedMotion || !canSubmit ? undefined : { scale: 0.98 }
              }
            >
              <Icon name="search" className="size-4" />
              Find past cases
            </motion.button>
            <output className="max-w-[300px] text-xs leading-relaxed text-ink-muted">
              {submitted
                ? "This is a UI preview. Case retrieval is not connected yet."
                : "Enter a request or choose a sample below."}
            </output>
          </div>
        </form>
        {companion}
      </div>
      <section aria-labelledby="samples-title">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 id="samples-title" className="font-heading text-sm font-bold">
            Try a sample request
          </h2>
          <span className="text-xs text-ink-muted">Click any to load</span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {requestSamples.map((sample) => (
            <motion.button
              key={sample.title}
              type="button"
              onClick={() => loadSample(sample)}
              aria-pressed={
                request === `[${sample.title}]\n${sample.description}`
              }
              initial={false}
              whileTap={reducedMotion ? undefined : { scale: 0.99 }}
              className="group flex min-h-[138px] flex-col justify-between gap-4 rounded-card border border-line bg-surface-soft p-4 text-left transition-colors duration-180 ease-interface hover:border-foreground hover:bg-surface"
            >
              <span>
                <span className="block font-heading text-[13px] leading-snug font-bold">
                  {sample.title}
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-ink-muted">
                  {sample.summary}
                </span>
              </span>
              <span className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sample.badgeClass}`}
                >
                  {sample.category}
                </span>
                <span className="flex size-6 items-center justify-center rounded-full bg-surface transition-colors duration-180 ease-interface group-hover:bg-lime">
                  <Icon name="outward" className="size-3.5" />
                </span>
              </span>
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  );
}
