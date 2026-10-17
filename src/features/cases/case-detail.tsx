"use client";
import { ArrowUpRightIcon, FileTextIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AIReadingRecord } from "./ai-reading-record";
import {
  OVERVIEW_KEYS,
  OVERVIEW_SECTIONS,
  type OverviewEvidence,
  overviewStale,
} from "./case-overview";
import { CaseStatusBadge } from "./case-status";
import { SourceViewer } from "./source-viewer";
import type { CaseDetail as CaseDetailRecord } from "./types";

export function CaseDetail({
  record,
  actions,
  onSourceChange,
}: {
  record: CaseDetailRecord;
  actions?: ReactNode;
  onSourceChange?: () => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [desktop, setDesktop] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const overview = record.overview;
  const selectedFinding = overview
    ? OVERVIEW_KEYS.flatMap((key) => overview.sections[key]).find(
        (f) => f.id === params.get("finding"),
      )
    : undefined;
  const selected = selectedFinding?.evidence[Number(params.get("ref") ?? 0)];
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (params.get("source") && !params.get("finding"))
      document.getElementById("original-sources")?.scrollIntoView();
  }, [params]);
  function inspect(id: string, index: number, button: HTMLButtonElement) {
    trigger.current = button;
    const next = new URLSearchParams(params);
    next.set("finding", id);
    next.set("ref", String(index));
    router.replace(`?${next}`, { scroll: false });
  }
  function close() {
    const next = new URLSearchParams(params);
    next.delete("finding");
    next.delete("ref");
    router.replace(next.size ? `?${next}` : `/case-library/${record.id}`, {
      scroll: false,
    });
    requestAnimationFrame(() => trigger.current?.focus());
  }
  const stale = overview ? overviewStale(overview, record.sources) : false;
  const reviewed =
    record.aiReview?.sourceIds ??
    (record.aiReview ? [record.aiReview.sourceId] : []);
  const legacyStale =
    !overview &&
    record.aiReview &&
    (reviewed.length !== record.sources.length ||
      record.sources.some((s) => !reviewed.includes(s.id)));
  return (
    <div id="case-detail" className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {record.is_seed ? "Fictional sample · Read-only" : "Your case"}
          </Badge>
          <CaseStatusBadge status={record.status} />
          {overview && (
            <Badge variant="outline">
              {overview.provenance === "curated"
                ? "Prepared sample overview"
                : overview.provenance === "ai"
                  ? "Reviewed AI overview"
                  : "Contributor overview"}
            </Badge>
          )}
        </div>
        <h1 className="font-heading text-2xl leading-tight font-bold wrap-anywhere md:text-3xl">
          {record.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {record.sources.length} source{" "}
          {record.sources.length === 1 ? "document" : "documents"} · Read the
          case, then check the evidence.
        </p>
        <div className="flex flex-wrap gap-2">
          {actions}
          <Link
            href={`/?case=${record.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Ask Wren about this case
          </Link>
        </div>
      </header>
      {(stale || legacyStale) && (
        <Alert variant="caution">
          <AlertTitle>Overview needs refresh</AlertTitle>
          <AlertDescription>
            Documents changed after this overview was reviewed. Read case with
            AI to prepare a new draft. Your saved notes stay until you confirm.
          </AlertDescription>
        </Alert>
      )}
      {record.status === "failed" && (
        <Alert variant="destructive">
          <AlertTitle>Source processing needs attention</AlertTitle>
          <AlertDescription>
            {record.error_message} Open Sources below to retry the affected
            document.
          </AlertDescription>
        </Alert>
      )}
      {record.aiReading && record.aiReview?.id !== record.aiReading.id && (
        <Alert>
          <AlertTitle>
            {record.aiReading.status === "ready"
              ? "AI draft ready for review"
              : record.aiReading.status === "failed"
                ? "AI reading paused"
                : "AI reading in progress"}
          </AlertTitle>
          <AlertDescription>
            {record.aiReading.error ??
              `${record.aiReading.completed}/${record.aiReading.total} sections read.`}{" "}
            Open Read case with AI to resume or review.
          </AlertDescription>
        </Alert>
      )}
      {overview ? (
        <>
          <nav
            aria-label="Case sections"
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
          >
            {OVERVIEW_KEYS.map((key) => (
              <a
                key={key}
                href={`#${key}`}
                className="underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                {OVERVIEW_SECTIONS[key]}
              </a>
            ))}
          </nav>
          <div className="case-folio">
            <div className="case-narrative overflow-hidden rounded-panel border border-border bg-muted">
              {OVERVIEW_KEYS.map((key) => (
                <section
                  key={key}
                  id={key}
                  aria-labelledby={`${key}-title`}
                  className={`border-b border-border p-5 last:border-0 md:p-7 ${key === "summary" ? "bg-accent/40" : ""}`}
                >
                  <h2
                    id={`${key}-title`}
                    className="mb-4 font-heading text-lg font-bold"
                  >
                    {OVERVIEW_SECTIONS[key]}
                  </h2>
                  {key === "summary" && (
                    <p className="mb-4 text-sm font-semibold text-muted-foreground">
                      {overview.classification === "non_project"
                        ? "Non-project material"
                        : overview.sections.results.length
                          ? "Results documented · Check their scope below"
                          : "Outcome not recorded · Success is not established"}
                    </p>
                  )}
                  {overview.sections[key].length ? (
                    <ul className="flex flex-col gap-5">
                      {overview.sections[key].map((finding) => (
                        <li key={finding.id} className="flex flex-col gap-2">
                          {finding.origin === "user" && (
                            <span className="text-xs font-semibold text-muted-foreground">
                              Contributor note · Evidence not verified
                            </span>
                          )}
                          <p className="leading-relaxed wrap-anywhere whitespace-pre-wrap">
                            {finding.text}
                          </p>
                          {!!finding.evidence.length && (
                            <div className="flex flex-wrap gap-2">
                              {finding.evidence.map((ref, index) => (
                                <Button
                                  key={`${ref.sourceId}-${index}`}
                                  variant="outline"
                                  size="sm"
                                  aria-label={`Inspect evidence ${index + 1} for ${finding.text.slice(0, 65)}`}
                                  aria-pressed={
                                    selectedFinding?.id === finding.id &&
                                    Number(params.get("ref") ?? 0) === index
                                  }
                                  onClick={(e) =>
                                    inspect(finding.id, index, e.currentTarget)
                                  }
                                >
                                  <FileTextIcon
                                    aria-hidden="true"
                                    className="size-3.5"
                                  />
                                  <span className="max-w-48 truncate">
                                    {ref.sourceTitle ?? "Source"}
                                  </span>
                                  {ref.page !== null && (
                                    <span className="shrink-0">
                                      p. {ref.page}
                                    </span>
                                  )}
                                </Button>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">
                      {key === "results"
                        ? "Outcome not recorded. The supplied documents do not establish an undisputed actual result."
                        : "Not documented."}
                    </p>
                  )}
                </section>
              ))}
            </div>
            {desktop && selected && (
              <aside
                className="case-evidence-panel rounded-panel border border-border bg-muted p-5"
                aria-label="Supporting source"
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="font-heading font-bold">Supporting source</h2>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={close}
                    aria-label="Close supporting source"
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </div>
                <EvidenceContent
                  evidence={selected}
                  record={record}
                  claim={selectedFinding?.text ?? ""}
                />
              </aside>
            )}
          </div>
          <Dialog
            open={!desktop && !!selected}
            onOpenChange={(open) => {
              if (!open) close();
            }}
          >
            <DialogContent
              className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
              finalFocus={trigger}
            >
              <DialogHeader>
                <DialogTitle>Supporting source</DialogTitle>
                <DialogDescription>
                  Check the original passage behind this finding.
                </DialogDescription>
              </DialogHeader>
              {selected && (
                <EvidenceContent
                  evidence={selected}
                  record={record}
                  claim={selectedFinding?.text ?? ""}
                />
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <section
          className="flex flex-col gap-5 rounded-panel border border-border bg-muted p-6"
          aria-label="Saved case details"
        >
          <h2 className="font-heading text-lg font-bold">Saved case details</h2>
          <p className="leading-relaxed wrap-anywhere whitespace-pre-wrap">
            {record.context || "No project context was supplied."}
          </p>
          <h3 className="font-semibold">Recorded outcome</h3>
          <p className="wrap-anywhere whitespace-pre-wrap">
            {record.outcome ||
              "Outcome not recorded. Success is not established."}
          </p>
          {record.lessons && (
            <>
              <h3 className="font-semibold">Recorded lessons</h3>
              <p className="wrap-anywhere whitespace-pre-wrap">
                {record.lessons}
              </p>
            </>
          )}
          <p className="text-sm text-muted-foreground">
            This case has no structured overview yet. Read case with AI or write
            an overview to organize it.
          </p>
        </section>
      )}
      <details
        id="original-sources"
        open={!!params.get("source")}
        className="rounded-panel border border-border bg-muted p-5"
      >
        <summary className="cursor-pointer font-heading text-lg font-bold">
          Sources{" "}
          <span className="font-normal text-muted-foreground">
            ({record.sources.length})
          </span>
        </summary>
        <div className="pt-5">
          <SourceViewer
            key={`${record.id}:${params.get("source")}:${params.get("page")}:${params.get("start")}:${params.get("end")}`}
            sources={record.sources}
            readOnly={record.is_seed}
            onChange={onSourceChange}
          />
        </div>
      </details>
      {record.aiReview && <AIReadingRecord review={record.aiReview} />}
    </div>
  );
}
function EvidenceContent({
  evidence,
  record,
  claim,
}: {
  evidence: OverviewEvidence;
  record: CaseDetailRecord;
  claim: string;
}) {
  const source = record.sources.find((s) => s.id === evidence.sourceId);
  if (
    !source ||
    (evidence.sourceVersion !== undefined &&
      source.version !== evidence.sourceVersion)
  )
    return (
      <output>
        This source version is unavailable. The reference has not been replaced.
      </output>
    );
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm text-muted-foreground">Finding: {claim}</p>
      <h3 className="font-heading font-semibold wrap-anywhere">
        {source.title}
      </h3>
      <p className="text-xs text-muted-foreground">
        Version {source.version}
        {evidence.page !== null
          ? ` · Physical page ${evidence.page}`
          : " · Text excerpt"}
      </p>
      <blockquote className="rounded-card border-l-4 border-primary bg-card p-4 leading-relaxed wrap-anywhere whitespace-pre-wrap">
        “{evidence.quote}”
      </blockquote>
      <a
        className={buttonVariants({ variant: "outline" })}
        href={`/api/sources/${source.id}/original${evidence.page === null ? "" : `#page=${evidence.page}`}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open original{evidence.page === null ? "" : ` · Page ${evidence.page}`}
        <ArrowUpRightIcon aria-hidden="true" className="size-4" />
      </a>
      <p className="text-xs text-muted-foreground">
        The quote matches the source text. Check whether it supports the finding
        and its scope.
      </p>
    </div>
  );
}
