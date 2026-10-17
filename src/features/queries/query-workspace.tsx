"use client";

import {
  ArrowLeftIcon,
  ArrowUpIcon,
  BookOpenIcon,
  CornerDownRightIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/workspace/theme-toggle";
import { caseApi } from "@/features/cases/api-client";
import { useRequestDraft } from "@/features/requests/request-draft";
import { CaseCard, Citation } from "./query-evidence";
import { useQueryHistory } from "./query-history";
import type { QueryConversation, QueryFocus, QueryTurn } from "./types";

export function QueryWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const { updateDraft } = useRequestDraft();
  const { refresh } = useQueryHistory();
  const [conversation, setConversation] = useState<QueryConversation | null>(
    null,
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const [focus, setFocus] = useState<QueryFocus>({
    scope: "library",
    caseId: null,
  });
  const input = useRef<HTMLTextAreaElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const submission = useRef<{ key: string; id: string } | null>(null);
  const latest = conversation?.turns.at(-1);
  const processing =
    latest?.status === "processing" &&
    Date.now() - new Date(latest.started_at).getTime() < 300000;
  const busy = pending || processing;
  const latestWork = [...(conversation?.turns ?? [])]
    .reverse()
    .find((turn) => turn.work)?.work;
  const result = latestWork?.retrieval;
  const focusCase = result?.cases.find((record) => record.id === focus.caseId);
  const focusTitle =
    focusCase?.title ??
    (latestWork?.focus.caseId === focus.caseId
      ? latestWork.focusTitle
      : null) ??
    (focus.caseId === conversation?.focused_case_id
      ? "Selected case"
      : "Focused case");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        await caseApi("/api/demo-session", { method: "POST" });
        const { query } = await caseApi<{ query: QueryConversation }>(
          `/api/queries/${id}`,
        );
        if (!active) return;
        setConversation(query);
        const last = query.turns.at(-1);
        const initialFocus: QueryFocus =
          last?.work?.focus ??
          (last
            ? { scope: last.scope, caseId: last.focused_case_id }
            : {
                scope: query.focused_case_id ? "case" : "library",
                caseId: query.focused_case_id,
              });
        setFocus(initialFocus);
        setError("");
        if (!query.turns.length) {
          setPending(true);
          const response = await caseApi<{ query: QueryConversation }>(
            `/api/queries/${id}/turns`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestKey: id,
                message: query.request.request,
                ...initialFocus,
              }),
            },
          );
          if (active) {
            setConversation(response.query);
            setFocus(response.query.turns.at(-1)?.work?.focus ?? initialFocus);
            void refresh();
          }
        }
      } catch (error) {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Could not open this query.",
          );
      } finally {
        if (active) setPending(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, refresh]);

  useEffect(() => {
    if (!processing && !pending) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      caseApi<{ query: QueryConversation }>(`/api/queries/${id}`, {
        signal: controller.signal,
      })
        .then(({ query }) => {
          if (!controller.signal.aborted) {
            setConversation(query);
            if (
              query.turns.at(-1)?.status === "ready" &&
              query.turns.at(-1)?.work
            )
              setFocus(
                query.turns.at(-1)?.work?.focus ?? {
                  scope: "library",
                  caseId: null,
                },
              );
          }
        })
        .catch(() => {});
    }, 3000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [processing, pending, id]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll after new messages or pending indicators render.
  useEffect(() => {
    if (followBottom.current && thread.current)
      thread.current.scrollTop = thread.current.scrollHeight;
  }, [conversation, pending]);

  async function send(
    message: string,
    target: QueryFocus = focus,
    retry?: QueryTurn,
  ) {
    if (busy || !message.trim()) return;
    const key = JSON.stringify({ message, focus: target });
    if (submission.current?.key !== key)
      submission.current = { key, id: crypto.randomUUID() };
    const requestKey = retry?.id ?? submission.current.id;
    setPending(true);
    setError("");
    followBottom.current = true;
    const sentDraft = draftRef.current;
    try {
      const { query } = await caseApi<{ query: QueryConversation }>(
        `/api/queries/${id}/turns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestKey, message, ...target }),
        },
      );
      setConversation(query);
      setFocus(query.turns.at(-1)?.work?.focus ?? target);
      if (message === sentDraft && draftRef.current === sentDraft) setDraft("");
      submission.current = null;
      void refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not submit this question. Your draft is preserved.",
      );
      try {
        setConversation(
          (await caseApi<{ query: QueryConversation }>(`/api/queries/${id}`))
            .query,
        );
      } catch {}
    } finally {
      setPending(false);
    }
  }
  function selectCase(caseId: string) {
    setFocus({ scope: "case", caseId });
    input.current?.focus();
  }
  function newQuery(edit = false) {
    updateDraft(
      edit && conversation
        ? conversation.request
        : { request: "", deadline: "", technology: "", capabilities: "" },
    );
    router.push(
      edit && conversation?.focused_case_id
        ? `/?case=${conversation.focused_case_id}&edit=${id}`
        : "/",
    );
  }
  if (!conversation)
    return (
      <div
        className="flex min-h-80 flex-col justify-center gap-4"
        aria-live="polite"
      >
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not open query</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <p className="flex items-center gap-2 text-muted-foreground">
            <LoaderCircleIcon
              className="size-4 animate-spin"
              aria-hidden="true"
            />
            Opening your query…
          </p>
        )}
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Start a new request
        </Link>
      </div>
    );
  return (
    <div className="query-workspace">
      <header className="query-toolbar">
        <div className="flex items-center gap-2 text-sm">
          <MessageSquareIcon
            className="size-4 text-knowledge-ink"
            aria-hidden="true"
          />
          <h1 className="font-semibold">Query workspace</h1>
          <span className="hidden text-muted-foreground sm:inline">
            / Ask Wren
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground md:inline">
            Saved for this demo session
          </span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => newQuery()}>
            <PlusIcon aria-hidden="true" />
            New request
          </Button>
        </div>
      </header>
      <section className="query-intent" aria-label="Submitted request">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted-foreground">
            Submitted request
          </span>
          <Button variant="ghost" size="sm" onClick={() => newQuery(true)}>
            Edit query
          </Button>
        </div>
        <p className="mt-1 font-heading text-lg leading-relaxed font-bold wrap-anywhere">
          {conversation.request.request}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["technology", "Technology"],
              ["capabilities", "Capabilities"],
              ["deadline", "Timeline"],
            ] as const
          ).map(
            ([key, label]) =>
              conversation.request[key] && (
                <Badge
                  key={key}
                  variant="outline"
                  className="max-w-full whitespace-normal"
                >
                  {label}: {conversation.request[key]}
                </Badge>
              ),
          )}
        </div>
      </section>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="query-panels">
        <section className="query-chat" aria-labelledby="wren-title">
          <header className="flex items-center gap-3 border-b border-border p-4 md:p-5">
            <div className="relative size-11 overflow-hidden rounded-control border border-border bg-secondary">
              <Image
                src="/images/wren.png"
                alt=""
                fill
                sizes="44px"
                className="object-cover object-top"
              />
            </div>
            <div>
              <h2 id="wren-title" className="font-heading font-bold">
                Wren, your team archivist
              </h2>
              <p className="text-xs text-muted-foreground">
                Past work, with evidence you can inspect
              </p>
            </div>
            <SparklesIcon
              className="ml-auto size-4 text-knowledge-ink"
              aria-hidden="true"
            />
          </header>
          <div
            className="query-thread"
            ref={thread}
            onScroll={() => {
              const node = thread.current;
              if (node)
                followBottom.current =
                  node.scrollHeight - node.scrollTop - node.clientHeight < 80;
            }}
            role="log"
            aria-label="Conversation with Wren"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {!conversation.turns.length && (
              <p className="text-sm text-muted-foreground">
                Finding relevant past work for your request…
              </p>
            )}
            {conversation.turns.map((turn) => (
              <article key={turn.id} className="flex flex-col gap-4">
                <div className="query-user-message">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                    You
                  </p>
                  <p className="wrap-anywhere whitespace-pre-wrap">
                    {turn.message}
                  </p>
                </div>
                <div className="query-wren-message">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-knowledge-ink">
                    <SparklesIcon className="size-3.5" aria-hidden="true" />
                    Wren
                  </p>
                  {turn.answer?.sections.map((section, index) => (
                    <section
                      key={`${turn.id}-${index}`}
                      className="query-answer-section"
                      data-kind={section.kind}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">
                          {section.heading}
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          {
                            {
                              fact: "Recorded fact",
                              inference: "Inference",
                              recommendation: "Recommendation",
                              unknown: "Missing information",
                            }[section.kind]
                          }
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
                        {section.text}
                      </p>
                      {!!section.evidence.length && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {section.evidence.map((evidenceId) => {
                            const evidence = turn.work?.evidence.find(
                              (item) => item.id === evidenceId,
                            );
                            return evidence ? (
                              <Citation key={evidenceId} evidence={evidence} />
                            ) : null;
                          })}
                        </div>
                      )}
                    </section>
                  ))}
                  {turn.work?.clarification && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {turn.work.candidates.map((record) => (
                        <Button
                          key={record.id}
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            selectCase(record.id);
                            void send(turn.message, {
                              scope: "case",
                              caseId: record.id,
                            });
                          }}
                        >
                          {record.title}
                          <span className="text-muted-foreground">
                            {record.id.slice(0, 6)}
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                  {turn.work?.evidence.some((item) => item.stale) && (
                    <Alert variant="caution">
                      <AlertDescription>
                        Some original sources have changed. This saved answer
                        shows the excerpts used at the time; inspect the current
                        case before reusing it.
                      </AlertDescription>
                    </Alert>
                  )}
                  {turn.error_message && (
                    <Alert variant="caution">
                      <AlertTitle>Answer paused</AlertTitle>
                      <AlertDescription>{turn.error_message}</AlertDescription>
                    </Alert>
                  )}
                  {turn.status === "processing" && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircleIcon
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      {processing
                        ? "Finding evidence and checking the answer…"
                        : "This turn was interrupted. Retry to resume."}
                    </p>
                  )}
                  {turn.id === latest?.id &&
                    turn.status !== "ready" &&
                    !busy && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() =>
                          void send(
                            turn.message,
                            { scope: turn.scope, caseId: turn.focused_case_id },
                            turn,
                          )
                        }
                      >
                        Retry this turn
                      </Button>
                    )}
                </div>
              </article>
            ))}
            {pending && latest?.status !== "processing" && (
              <output className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircleIcon
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Wren is finding evidence and checking the answer…
              </output>
            )}
          </div>
          <form
            className="query-chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BookOpenIcon className="size-3.5" aria-hidden="true" />
                {focus.scope === "library"
                  ? "Searching all cases"
                  : `${focus.scope === "related" ? "Related to" : "Focused on"}: ${focusTitle}`}
              </span>
              {focus.scope !== "library" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  disabled={busy}
                  onClick={() => {
                    setFocus({ scope: "library", caseId: null });
                    input.current?.focus();
                  }}
                >
                  Search all cases
                </Button>
              )}
            </div>
            <div className="query-input-row">
              <label htmlFor="follow-up" className="sr-only">
                Ask Wren a follow-up question
              </label>
              <Textarea
                id="follow-up"
                ref={input}
                rows={2}
                maxLength={10000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about a case, its caveats, or what changes this time…"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    if (!busy && draft.trim()) void send(draft);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon-lg"
                aria-label="Send question"
                disabled={busy || !draft.trim()}
              >
                <ArrowUpIcon aria-hidden="true" />
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Enter to send · Shift+Enter for a new line ·{" "}
              {draft.length.toLocaleString("en-US")} / 10,000
            </p>
          </form>
        </section>
        <aside className="query-cases" aria-label="Relevant cases and evidence">
          <details open className="query-case-results">
            <summary className="cursor-pointer p-5 font-heading font-bold">
              Relevant cases ({result?.cases.length ?? 0})
            </summary>
            <div className="flex flex-col gap-4 px-4 pb-5 md:px-5">
              {result && (
                <Badge variant="outline" className="self-start">
                  {result.mode === "hybrid"
                    ? "Semantic + keyword search"
                    : "Keyword search only"}
                </Badge>
              )}
              {result?.warnings.map((warning) => (
                <Alert key={warning} variant="caution">
                  <AlertDescription>{warning}</AlertDescription>
                </Alert>
              ))}
              {!result?.cases.length && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <SearchIcon
                    className="mx-auto mb-3 size-6"
                    aria-hidden="true"
                  />
                  {busy
                    ? "Looking for supporting cases…"
                    : latestWork?.clarification
                      ? "Choose a case to continue."
                      : "No supporting cases yet. Try a specific capability or select a case from the library."}
                </div>
              )}
              {result?.cases.map((record, index) => (
                <CaseCard
                  key={record.id}
                  record={record}
                  rank={index + 1}
                  focused={record.id === focus.caseId}
                  disabled={busy}
                  reason={
                    latest?.answer?.sections.find(
                      (section) =>
                        section.kind === "inference" &&
                        section.evidence.some((id) =>
                          latest.work?.evidence.some(
                            (item) =>
                              item.id === id && item.case_id === record.id,
                          ),
                        ),
                    )?.text
                  }
                  onFocus={() => selectCase(record.id)}
                  onRelated={() => {
                    setFocus({ scope: "related", caseId: record.id });
                    void send(
                      `Find other cases related to ${record.title}, and explain the relevant similarities and differences.`,
                      { scope: "related", caseId: record.id },
                    );
                  }}
                />
              ))}
            </div>
          </details>
          <div className="rounded-panel border border-border bg-secondary p-5 text-sm leading-relaxed">
            <p className="mb-2 flex items-center gap-2 font-semibold">
              <CornerDownRightIcon className="size-4" aria-hidden="true" />
              Keep asking, follow the evidence
            </p>
            <p className="text-muted-foreground">
              Answers use selected source excerpts. Open citations to check the
              context, then ask what changes for your request.
            </p>
            <Link
              href="/case-library"
              className="mt-3 inline-flex items-center gap-2 font-semibold underline underline-offset-4"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
              Browse the case library
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
