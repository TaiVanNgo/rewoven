import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { requestSamples } from "@/lib/request-samples";

export function RequestComposer({ companion }: { companion: ReactNode }) {
  return (
    <div className="space-y-9">
      <div className="grid grid-cols-1 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_310px]">
        <form className="min-w-0 rounded-panel border border-line bg-surface-soft p-5 shadow-panel md:p-7">
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
            disabled
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
              0 / 10,000
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
                  disabled
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
                  disabled
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
                  disabled
                  className="field"
                  placeholder="e.g. Two approval stages"
                />
              </div>
            </div>
          </fieldset>
          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
            <button type="submit" disabled className="action">
              <Icon name="search" className="size-4" />
              Find past cases
            </button>
            <p className="text-xs text-ink-muted">
              Interactions are being prepared.
            </p>
          </div>
        </form>
        {companion}
      </div>
      <section aria-labelledby="samples-title">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 id="samples-title" className="font-heading text-sm font-bold">
            Try a sample request
          </h2>
          <span className="text-xs text-ink-muted">Preview samples</span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {requestSamples.map((sample) => (
            <button
              key={sample.title}
              type="button"
              disabled
              className="flex min-h-[138px] flex-col justify-between gap-4 rounded-card border border-line bg-surface-soft p-4 text-left"
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
                <span className="flex size-6 items-center justify-center rounded-full bg-surface">
                  <Icon name="outward" className="size-3.5" />
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
