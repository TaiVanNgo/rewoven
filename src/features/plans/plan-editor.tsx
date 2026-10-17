"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { caseApi } from "@/features/cases/api-client";
import {
  CitationMarker,
  CitationProvider,
} from "@/features/citations/citation-marker";
import { passageCitation, requestCitation } from "@/features/citations/types";
import { referencedSources, validateMarkdown } from "./content";
import type { PlanBrief, ReusePlan } from "./types";
import "./plans.css";

const Preview = dynamic(
  () => import("./plan-preview").then((m) => m.PlanPreview),
  { loading: () => <p>Preparing preview…</p> },
);
const FormattedEditor = dynamic(
  () => import("./formatted-plan-editor").then((m) => m.FormattedPlanEditor),
  { ssr: false, loading: () => <output>Preparing editor…</output> },
);
const jsonHeaders = { "Content-Type": "application/json" };
export function PlanEditor({ id }: { id: string }) {
  const [plan, setPlan] = useState<ReusePlan | null>(null);
  const [brief, setBrief] = useState<PlanBrief | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("edit");
  const [original, setOriginal] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const ready = plan?.status === "ready";
  const dirty =
    !!ready &&
    (!plan.saved_at ||
      title !== plan.saved_title ||
      markdown !== plan.saved_markdown);
  const deferredMarkdown = useDeferredValue(markdown);
  const recoveryKey = `rewoven:plan:v1:${id}`;
  const baseline = useRef(false);
  const restore = useCallback((value: ReusePlan, recover = false) => {
    setPlan(value);
    setBrief(value.confirmed_request ?? value.brief);
    let nextTitle = value.saved_title ?? value.title;
    let nextMarkdown = value.saved_markdown ?? value.generated_markdown ?? "";
    if (recover && value.status === "ready") {
      try {
        const stored = JSON.parse(
          sessionStorage.getItem(`rewoven:plan:v1:${value.id}`) ?? "null",
        );
        if (
          stored &&
          stored.expires > Date.now() &&
          typeof stored.title === "string" &&
          typeof stored.markdown === "string"
        ) {
          nextTitle = stored.title;
          nextMarkdown = stored.markdown;
          setRecovered(true);
          if (
            Number.isSafeInteger(stored.revision) &&
            stored.revision !== value.revision
          ) {
            setPlan({ ...value, revision: stored.revision });
            setError(
              "Your recovered edits were based on an older save. Open the latest saved version in another tab to compare before continuing.",
            );
          }
        }
      } catch {
        /* Storage may be unavailable. Server content remains usable. */
      }
    }
    setTitle(nextTitle);
    setMarkdown(nextMarkdown);
    baseline.current = true;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    caseApi<{ plan: ReusePlan }>(`/api/plans/${id}`, {
      signal: controller.signal,
    })
      .then(({ plan }) => restore(plan, true))
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          try {
            sessionStorage.removeItem(recoveryKey);
          } catch {}
        }
      });
    return () => controller.abort();
  }, [id, restore, recoveryKey]);
  const processing =
    plan?.status === "preparing" || plan?.status === "generating";
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => {
      caseApi<{ plan: ReusePlan }>(`/api/plans/${id}`)
        .then(({ plan: next }) => restore(next))
        .catch((e) => setError(e.message));
    }, 1500);
    return () => clearInterval(timer);
  }, [id, processing, restore]);
  useEffect(() => {
    if (!ready || !baseline.current) return;
    try {
      if (dirty)
        sessionStorage.setItem(
          recoveryKey,
          JSON.stringify({
            title,
            markdown,
            revision: plan?.revision,
            expires: Date.now() + 24 * 60 * 60 * 1000,
          }),
        );
      else sessionStorage.removeItem(recoveryKey);
    } catch {
      /* Navigation warning still protects changes when storage is unavailable. */
    }
  }, [title, markdown, dirty, ready, recoveryKey, plan?.revision]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const navigation = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (
        !link ||
        link.target === "_blank" ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0 ||
        link.hasAttribute("aria-haspopup") ||
        link.hasAttribute("download")
      )
        return;
      const target = new URL(link.href, window.location.href);
      if (
        target.pathname === location.pathname &&
        target.search === location.search
      )
        return;
      if (
        !window.confirm(
          "Leave with unsaved changes? Your edits can be recovered in this tab, but they have not been saved.",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigation, true);
    };
  }, [dirty]);
  async function generate() {
    if (!brief || !plan) return;
    setBusy(true);
    setError("");
    try {
      const result = await caseApi<{ plan: ReusePlan }>(
        `/api/plans/${id}/generate`,
        { method: "POST", headers: jsonHeaders, body: JSON.stringify(brief) },
      );
      restore(result.plan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      const result = await caseApi<{ plan: ReusePlan }>(`/api/plans/${id}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ title, markdown, revision: plan.revision }),
      });
      restore(result.plan);
      setRecovered(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function retryPreparation() {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      const result = await caseApi<{ plan: ReusePlan }>(
        `/api/queries/${plan.conversation_id}/plans`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ requestKey: plan.id, contextRevision: 0 }),
        },
      );
      restore(result.plan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setError("");
    try {
      const response = await fetch(`/api/plans/${id}/export`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "reuse-plan.md";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!plan)
    return (
      <div>
        <output>{error || "Opening your draft…"}</output>
        <Link href="/saved-plans" className="mt-4 inline-block underline">
          Return to saved plans
        </Link>
      </div>
    );
  let citationWarning = "";
  if (ready) {
    try {
      validateMarkdown(markdown, plan.evidence);
    } catch (e) {
      citationWarning = (e as Error).message;
    }
  }
  const currentReferences = new Set(
    referencedSources(markdown, plan?.evidence ?? []).map((r) => r.number),
  );
  const missingReferences =
    ready &&
    referencedSources(plan.generated_markdown ?? "", plan.evidence).some(
      (r) => !currentReferences.has(r.number),
    );
  const staleProcessing =
    processing && Date.now() - new Date(plan.started_at).getTime() > 300000;
  return (
    <CitationProvider>
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="text-sm underline"
            href={`/?query=${plan.conversation_id}`}
          >
            Back to originating chat
          </Link>
          <Link href="/saved-plans" className="text-sm underline">
            Saved plans
          </Link>
        </div>
        {(error || plan.error_message) && (
          <Alert variant="caution">
            <AlertDescription>{error || plan.error_message}</AlertDescription>
          </Alert>
        )}
        {[...plan.snapshot.warnings, ...plan.warnings].map((w) => (
          <p className="text-sm text-caution-foreground" key={w}>
            {w}
          </p>
        ))}
        {processing && (
          <div
            aria-live="polite"
            className="rounded-workspace bg-secondary p-6"
          >
            <h2 className="font-heading text-xl font-bold">
              {plan.status === "preparing"
                ? "Preparing your request for review…"
                : "Finding evidence and drafting your plan…"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your draft is stored. You can return here if the connection is
              interrupted.
            </p>
            {staleProcessing && (
              <Button
                className="mt-4"
                disabled={busy}
                onClick={() =>
                  void (plan.status === "preparing"
                    ? retryPreparation()
                    : generate())
                }
              >
                Retry interrupted stage
              </Button>
            )}
          </div>
        )}
        {!processing && !ready && brief && (
          <section className="rounded-workspace border border-border bg-card p-5 sm:p-7">
            <h2 className="font-heading text-2xl font-bold">
              Review the work you want to plan
            </h2>
            <p className="mt-2 mb-6 max-w-2xl text-sm text-muted-foreground">
              Correct Wren’s summary before generating. These requirements
              describe proposed work; your historical sources remain separate.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              {(
                [
                  ["title", "Plan title"],
                  ["request", "Requirements"],
                  ["deadline", "Deadline"],
                  ["technology", "Technology"],
                  ["capabilities", "Required capabilities"],
                  ["questions", "Open questions"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  htmlFor={`brief-${key}`}
                  className={`flex flex-col gap-2 text-sm font-semibold ${key === "request" || key === "title" ? "sm:col-span-2" : ""}`}
                >
                  <span>{label}</span>
                  {key === "request" || key === "questions" ? (
                    <Textarea
                      id={`brief-${key}`}
                      rows={key === "request" ? 6 : 3}
                      maxLength={key === "request" ? 10000 : 1000}
                      value={brief[key]}
                      disabled={!!plan.confirmed_request || busy}
                      onChange={(e) =>
                        setBrief({ ...brief, [key]: e.target.value })
                      }
                    />
                  ) : (
                    <Input
                      id={`brief-${key}`}
                      value={brief[key]}
                      maxLength={key === "title" ? 120 : 1000}
                      disabled={!!plan.confirmed_request || busy}
                      onChange={(e) =>
                        setBrief({ ...brief, [key]: e.target.value })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <Button
              className="mt-6"
              disabled={busy || !brief.request.trim() || !brief.title.trim()}
              onClick={() => void generate()}
            >
              {busy
                ? "Generating…"
                : plan.status === "failed"
                  ? "Retry generation"
                  : "Confirm request and generate plan"}
            </Button>
            {plan.confirmed_request && (
              <p className="mt-3 text-sm text-muted-foreground">
                Retries use this confirmed request. Return to the chat to create
                a different plan.
              </p>
            )}
          </section>
        )}
        {ready && (
          <>
            <div className="rounded-workspace border border-border bg-secondary/40 p-5">
              <p className="text-sm font-semibold text-knowledge-ink">
                {plan.kind === "clarification"
                  ? "Clarification draft — no suitable precedent found"
                  : "Reuse plan — draft for human review"}
              </p>
              <label
                htmlFor="plan-title"
                className="mt-3 block text-sm font-semibold"
              >
                Plan title
                <Input
                  id="plan-title"
                  className="mt-2 font-heading text-lg"
                  maxLength={120}
                  disabled={busy}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-semibold">
                  Confirmed request and constraints
                </summary>
                <p className="mt-3 whitespace-pre-wrap">
                  {plan.confirmed_request?.request}
                </p>
                {(
                  [
                    "deadline",
                    "technology",
                    "capabilities",
                    "questions",
                  ] as const
                ).map(
                  (k) =>
                    plan.confirmed_request?.[k] && (
                      <p key={k} className="mt-2">
                        <strong className="capitalize">{k}: </strong>
                        {plan.confirmed_request[k]}
                      </p>
                    ),
                )}
              </details>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={busy || !dirty || !!citationWarning || !title.trim()}
                onClick={() => void save()}
              >
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="outline"
                disabled={busy || dirty || !plan.saved_at}
                onClick={() => void download()}
              >
                Export Markdown
              </Button>
              <output className="text-sm text-muted-foreground">
                {dirty
                  ? "Unsaved changes · Save before exporting"
                  : `Saved ${new Date(plan.saved_at ?? "").toLocaleString()}`}
              </output>
            </div>
            <p className="text-xs text-muted-foreground">
              Edited content is not automatically reverified against its
              sources. Keep markers such as [S1] beside supported claims; source
              definitions are managed separately.
            </p>
            {recovered && (
              <output className="text-sm text-knowledge-ink">
                Recovered unsaved edits from this tab. Choose Save to keep them
                in your plan.
              </output>
            )}
            {citationWarning && (
              <p role="alert" className="text-sm text-destructive">
                {citationWarning}
              </p>
            )}
            {missingReferences && (
              <p className="text-sm text-caution-foreground">
                All source markers were removed. This edited plan no longer
                links its claims to evidence.
              </p>
            )}
            <div className="flex gap-2 lg:hidden">
              <Button
                variant={tab === "edit" ? "default" : "outline"}
                onClick={() => setTab("edit")}
                aria-pressed={tab === "edit"}
              >
                Edit plan
              </Button>
              <Button
                variant={tab === "preview" ? "default" : "outline"}
                onClick={() => setTab("preview")}
                aria-pressed={tab === "preview"}
              >
                Preview
              </Button>
            </div>
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <section
                className={`${tab === "edit" ? "block" : "hidden"} min-w-0 lg:block`}
              >
                <h2 className="mb-3 font-heading font-bold">Edit plan</h2>
                <FormattedEditor
                  markdown={markdown}
                  editable={!busy}
                  onChange={setMarkdown}
                />
              </section>
              <section
                aria-label="Plan preview"
                className={`${tab === "preview" ? "block" : "hidden"} min-w-0 lg:block`}
              >
                <h2 className="mb-3 font-heading font-bold">Preview</h2>
                <div className="min-h-[560px] rounded-control border border-border bg-card p-5 sm:p-7">
                  <Preview
                    markdown={deferredMarkdown}
                    evidence={plan.evidence}
                  />
                </div>
              </section>
            </div>
            <details className="rounded-control border border-border p-5">
              <summary className="cursor-pointer font-heading font-bold">
                Original AI draft and evidence
              </summary>
              <Button
                variant="ghost"
                className="mt-3"
                onClick={() => setOriginal((v) => !v)}
                aria-expanded={original}
              >
                {original ? "Hide original draft" : "View original draft"}
              </Button>
              {original && (
                <div className="mt-4">
                  <Preview
                    markdown={plan.generated_markdown ?? ""}
                    evidence={plan.evidence}
                  />
                </div>
              )}
              <ul className="mt-4 flex flex-col gap-4">
                {(
                  plan.request_evidence ??
                  plan.snapshot.requestDocuments?.evidence ??
                  []
                ).map((e, i) => (
                  <li key={e.id}>
                    <CitationMarker
                      reference={requestCitation(e)}
                      number={plan.evidence.length + i + 1}
                    />
                    <span className="ml-2 text-sm">
                      Request document — {e.title}
                      {e.page ? `, page ${e.page}` : ""}
                    </span>
                    <blockquote className="mt-2 border-l-2 border-knowledge-ink pl-3 text-sm whitespace-pre-wrap text-muted-foreground">
                      {e.text}
                    </blockquote>
                  </li>
                ))}
                {plan.evidence.map((e, i) => (
                  <li key={e.id}>
                    <CitationMarker
                      reference={passageCitation(e)}
                      number={i + 1}
                    />
                    <span className="ml-2 text-sm">
                      {e.title} — {e.source_title}
                      {e.page_number ? `, page ${e.page_number}` : ""}
                    </span>
                    <blockquote className="mt-2 border-l-2 border-knowledge-ink pl-3 text-sm whitespace-pre-wrap text-muted-foreground">
                      {e.text}
                    </blockquote>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </CitationProvider>
  );
}
