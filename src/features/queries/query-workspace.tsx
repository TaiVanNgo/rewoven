"use client";

import {
  ArrowUpIcon,
  BookOpenIcon,
  LoaderCircleIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/workspace/theme-toggle";
import { caseApi } from "@/features/cases/api-client";
import { validateFile } from "@/features/cases/validation";
import {
  CitationMarker,
  CitationProvider,
} from "@/features/citations/citation-marker";
import {
  citationKey,
  passageCitation,
  requestCitation,
} from "@/features/citations/types";
import { ChatPlans } from "@/features/plans/chat-plans";
import {
  type PendingQueryUpload,
  prepareQueryFile,
  uploadQueryFile,
} from "@/features/query-files/client";
import {
  FileContext,
  MessageFiles,
  PendingFiles,
  UploadFilesButton,
} from "@/features/query-files/file-controls";
import {
  FILE_ONLY_MESSAGE,
  type QueryFile,
} from "@/features/query-files/types";
import { useRequestDraft } from "@/features/requests/request-draft";
import { AnswerText } from "./answer-text";
import { CasePicker, type SelectedCase } from "./case-picker";
import { answerCitationNumbers, CaseCard, Citation } from "./query-evidence";
import { useQueryHistory } from "./query-history";
import {
  type ChatContext,
  EMPTY_CHAT_CONTEXT,
  type QueryConversation,
  type QueryTurn,
} from "./types";
import { WrenMessage } from "./wren-message";

const stages = {
  understanding: "Understanding your message…",
  reviewing: "Reviewing case evidence…",
  answering: "Preparing your reply…",
};
export function QueryWorkspace(
  props: Parameters<typeof QueryWorkspaceContent>[0],
) {
  return (
    <CitationProvider>
      <QueryWorkspaceContent {...props} />
    </CitationProvider>
  );
}

function QueryWorkspaceContent({
  id,
  initialCaseId,
  companion,
  onCreateStart,
  onCreated,
  onCreateError,
  onReady,
  onLoadError,
}: {
  id: string | null;
  initialCaseId?: string | null;
  companion?: ReactNode;
  onCreateStart?: () => AbortSignal;
  onCreated?: (id: string) => void;
  onCreateError?: () => void;
  onReady?: (id: string) => void;
  onLoadError?: (id: string) => void;
}) {
  const router = useRouter();
  const { draft: requestDraft, updateDraft } = useRequestDraft();
  const { refresh } = useQueryHistory();
  const [conversation, setConversation] = useState<QueryConversation | null>(
    null,
  );
  const [context, setContext] = useState<ChatContext>(EMPTY_CHAT_CONTEXT);
  const [selected, setSelected] = useState<SelectedCase[]>([]);
  const [localDraft, setLocalDraft] = useState("");
  const draft = id ? localDraft : requestDraft.request;
  function setDraft(value: string) {
    if (id) setLocalDraft(value);
    else updateDraft({ request: value });
  }
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uploads, setUploads] = useState<PendingQueryUpload[]>([]);
  const [pendingMessage, setPendingMessage] = useState("");
  const [loaded, setLoaded] = useState(!id && !initialCaseId);
  const [showEvidence, setShowEvidence] = useState(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const fileOperation = useRef(new AbortController());
  useEffect(() => {
    fileOperation.current = new AbortController();
    return () => fileOperation.current.abort();
  }, []);
  const submission = useRef<{ key: string; id: string } | null>(null);
  const latest = conversation?.turns.at(-1);
  const processing =
    latest?.status === "processing" &&
    Date.now() - new Date(latest.started_at).getTime() < 300000;
  const busy = pending || processing;
  const work = latest?.work;
  const hasEvidence = !!work?.evidence.length;
  const opened = conversation !== null;
  useEffect(() => {
    if (id && opened) onReady?.(id);
  }, [id, opened, onReady]);
  useEffect(() => {
    if (id && !opened && error) onLoadError?.(id);
  }, [id, opened, error, onLoadError]);
  function addFiles(files: File[]) {
    if (busy) return;
    try {
      if (uploads.length + files.length > 5)
        throw new Error("Choose up to five files per message.");
      for (const file of files) {
        if (file.name.length > 200)
          throw new Error("Use a filename of at most 200 characters.");
        validateFile(file.name, file.size);
      }
      setUploads((previous) => [
        ...previous,
        ...files.map((file) => ({
          id: crypto.randomUUID(),
          file,
          state: "Ready to upload",
        })),
      ]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const updateFile = useCallback((file: QueryFile) => {
    setConversation((previous) =>
      previous
        ? {
            ...previous,
            files: (previous.files ?? []).map((f) =>
              f.id === file.id ? file : f,
            ),
          }
        : previous,
    );
  }, []);
  async function retryFile(file: QueryFile) {
    setPending(true);
    setError("");
    try {
      await prepareQueryFile(file, updateFile, fileOperation.current.signal);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      try {
        if (conversation)
          restore(
            (
              await caseApi<{ query: QueryConversation }>(
                `/api/queries/${conversation.id}`,
              )
            ).query,
          );
      } catch {
        /* A failed refresh must not leave the composer disabled. */
      }
      setPending(false);
    }
  }
  async function toggleFile(file: QueryFile) {
    setPending(true);
    setError("");
    try {
      const result = await caseApi<{ query: QueryConversation }>(
        `/api/query-files/${file.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: !file.enabled,
            contextRevision: conversation?.context_revision ?? 0,
          }),
        },
      );
      restore(result.query);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  const restore = useCallback((query: QueryConversation) => {
    setConversation(query);
    setContext(query.chat_context ?? EMPTY_CHAT_CONTEXT);
    setSelected(query.selected_cases ?? []);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        if (!id && !initialCaseId) return;
        await caseApi("/api/demo-session", {
          method: "POST",
          signal: controller.signal,
        });
        if (id) {
          const { query } = await caseApi<{ query: QueryConversation }>(
            `/api/queries/${id}`,
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          restore(query);
          setLoaded(true);
          if (!query.turns.length) {
            setPending(true);
            setLocalDraft(query.request.request);
            for (const file of query.files ?? [])
              if (file.enabled)
                await prepareQueryFile(file, updateFile, controller.signal);
            setPending(true);
            const { query: answered } = await caseApi<{
              query: QueryConversation;
            }>(`/api/queries/${id}/turns`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestKey: id,
                message: query.request.request,
                contextRevision: query.context_revision ?? 0,
                scope: query.focused_case_id ? "case" : "library",
                caseId: query.focused_case_id,
              }),
            });
            if (!controller.signal.aborted) {
              restore(answered);
              void refresh();
            }
          }
        } else if (initialCaseId) {
          const { case: record } = await caseApi<{ case: SelectedCase }>(
            `/api/cases/${initialCaseId}`,
            { signal: controller.signal },
          );
          if (!controller.signal.aborted) {
            setSelected([record]);
            setContext({ mode: "selected", caseIds: [record.id] });
          }
        }
      } catch (e) {
        // A remount may race the first submission; resume its saved processing turn.
        if (id && !controller.signal.aborted) {
          try {
            const { query } = await caseApi<{ query: QueryConversation }>(
              `/api/queries/${id}`,
              { signal: controller.signal },
            );
            if (query.turns.at(-1)?.status === "processing") {
              restore(query);
              return;
            }
          } catch {}
        }
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not open this chat.",
          );
      } finally {
        if (!controller.signal.aborted) {
          setLoaded(true);
          setPending(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [id, initialCaseId, refresh, restore, updateFile]);
  useEffect(() => {
    if (!id || (!processing && !pending)) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      caseApi<{ query: QueryConversation }>(`/api/queries/${id}`, {
        signal: controller.signal,
      })
        .then(({ query }) => {
          if (!controller.signal.aborted) restore(query);
        })
        .catch(() => {});
    }, 1500);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [id, processing, pending, restore]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll before paint when messages grow and the reader follows the bottom.
  useLayoutEffect(() => {
    if (followBottom.current && thread.current)
      thread.current.scrollTop = thread.current.scrollHeight;
  }, [conversation, pending]);

  async function applyCases(cases: SelectedCase[]) {
    const next: ChatContext = cases.length
      ? { mode: "selected", caseIds: cases.map((c) => c.id) }
      : EMPTY_CHAT_CONTEXT;
    if (id && conversation) {
      const { query } = await caseApi<{ query: QueryConversation }>(
        `/api/queries/${id}/context`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatContext: next,
            contextRevision: conversation.context_revision ?? 0,
          }),
        },
      );
      restore(query);
    } else {
      setContext(next);
      setSelected(cases);
    }
  }
  async function send(message: string, retry?: QueryTurn) {
    if (
      busy ||
      !loaded ||
      (!message.trim() &&
        !uploads.length &&
        !conversation?.files?.some((f) => f.enabled && !f.first_turn_id))
    )
      return;
    if (!message.trim()) message = FILE_ONLY_MESSAGE;
    const key = JSON.stringify({
      message,
      context,
      id,
      files: uploads.map((f) => f.id),
    });
    if (submission.current?.key !== key)
      submission.current = { key, id: crypto.randomUUID() };
    setPending(true);
    setPendingMessage(message);
    setError("");
    followBottom.current = true;
    const sentDraft = draftRef.current;
    let signal: AbortSignal | undefined;
    let activeConversationId = id ?? conversation?.id;
    try {
      await caseApi("/api/demo-session", { method: "POST", signal });
      if (signal?.aborted) return;
      if (!id) {
        const { query } = await caseApi<{ query: QueryConversation }>(
          "/api/queries",
          {
            method: "POST",
            signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...requestDraft,
              request: message,
              requestKey: submission.current.id,
              assistant: true,
              chatContext: context,
              files: uploads.map((f) => ({
                id: f.id,
                title: f.file.name,
                size: f.file.size,
              })),
            }),
          },
        );
        activeConversationId = query.id;
        restore(query);
        void refresh();
        await prepareUploads(query.id);
        signal = onCreateStart?.();
        if (signal?.aborted) return;
        setUploads([]);
        updateDraft({ ...requestDraft, request: "" });
        void refresh();
        onCreated?.(query.id);
        router.push(`/?query=${query.id}`);
      } else {
        let active = conversation;
        if (!retry && uploads.length) {
          const reserved = await caseApi<{ query: QueryConversation }>(
            `/api/queries/${id}/files`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                files: uploads.map((f) => ({
                  id: f.id,
                  title: f.file.name,
                  size: f.file.size,
                })),
              }),
            },
          );
          restore(reserved.query);
          await prepareUploads(id);
          active = (
            await caseApi<{ query: QueryConversation }>(`/api/queries/${id}`)
          ).query;
          restore(active);
        }
        if (!active?.assistant && !retry) {
          const response = await caseApi<{ query: QueryConversation }>(
            `/api/queries/${id}/context`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chatContext: context,
                contextRevision: active?.context_revision ?? 0,
              }),
            },
          );
          active = response.query;
          restore(active);
        }
        const { query } = await caseApi<{ query: QueryConversation }>(
          `/api/queries/${id}/turns`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestKey: retry?.id ?? submission.current.id,
              message,
              contextRevision: active?.context_revision ?? 0,
              ...(retry && !retry.context_snapshot
                ? { scope: retry.scope, caseId: retry.focused_case_id }
                : {}),
            }),
          },
        );
        restore(query);
        setUploads([]);
        void refresh();
      }
      if (message === sentDraft && draftRef.current === sentDraft) setDraft("");
      submission.current = null;
    } catch (e) {
      if (signal?.aborted) return;
      if (!id && signal) onCreateError?.();
      setError(
        e instanceof Error
          ? e.message
          : "Could not send your message. Your draft is preserved.",
      );
      if (activeConversationId)
        try {
          restore(
            (
              await caseApi<{ query: QueryConversation }>(
                `/api/queries/${activeConversationId}`,
              )
            ).query,
          );
        } catch {}
    } finally {
      setPending(false);
      setPendingMessage("");
    }
  }
  async function prepareUploads(conversationId: string) {
    const failures: string[] = [];
    for (const item of uploads) {
      try {
        await uploadQueryFile(
          item,
          (state) =>
            setUploads((previous) =>
              previous.map((f) =>
                f.id === item.id ? { ...f, state, error: undefined } : f,
              ),
            ),
          updateFile,
          fileOperation.current.signal,
        );
      } catch (e) {
        setUploads((previous) =>
          previous.map((f) =>
            f.id === item.id ? { ...f, error: (e as Error).message } : f,
          ),
        );
        if (fileOperation.current.signal.aborted) throw e;
        failures.push((e as Error).message);
      }
    }
    const current = (
      await caseApi<{ query: QueryConversation }>(
        `/api/queries/${conversationId}`,
      )
    ).query;
    restore(current);
    if (failures.length) throw new Error(failures.join(" "));
  }
  function newChat() {
    updateDraft({
      request: "",
      deadline: "",
      technology: "",
      capabilities: "",
    });
    setDraft("");
    setContext(EMPTY_CHAT_CONTEXT);
    setSelected([]);
    setError("");
    setUploads([]);
    setConversation(null);
    router.push("/");
  }
  const welcome = !id;
  return (
    <div
      className="query-workspace"
      data-evidence={hasEvidence && showEvidence}
    >
      <header className="query-toolbar">
        <div>
          <h1
            id="query-workspace-title"
            tabIndex={-1}
            className="font-heading text-lg font-bold"
          >
            Ask Wren
          </h1>
          <p className="text-xs text-muted-foreground">
            Your past work, ready for a conversation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={newChat} disabled={busy}>
            <PlusIcon aria-hidden="true" />
            New chat
          </Button>
        </div>
      </header>
      {error && (
        <Alert variant="destructive" data-query-open-error tabIndex={-1}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!loaded && (
        <output className="text-sm text-muted-foreground">
          Opening your chat…
        </output>
      )}
      {conversation && (
        <ChatPlans
          key={conversation.id}
          conversationId={conversation.id}
          contextRevision={conversation.context_revision ?? 0}
          disabled={busy}
        />
      )}
      <div className="query-panels">
        <section className="query-chat" aria-label="Chat with Wren">
          <header className="flex items-center gap-3 border-b border-border p-4">
            <div className="relative size-11 overflow-hidden rounded-control bg-secondary">
              <Image
                src="/images/wren.png"
                alt=""
                fill
                sizes="44px"
                className="object-cover object-top"
              />
            </div>
            <div>
              <h2 className="font-heading font-bold">
                Wren, your case advisor
              </h2>
              <p className="text-xs text-muted-foreground">
                Discuss decisions. Learn from your cases.
              </p>
            </div>
            {hasEvidence && (
              <Button
                className="ml-auto"
                variant="ghost"
                size="sm"
                aria-expanded={showEvidence}
                onClick={() => setShowEvidence((v) => !v)}
              >
                <BookOpenIcon aria-hidden="true" />
                Sources
              </Button>
            )}
          </header>
          <div
            ref={thread}
            className="query-thread"
            role="log"
            aria-label="Conversation with Wren"
            aria-live="polite"
            aria-relevant="additions text"
            onScroll={() => {
              const node = thread.current;
              if (node)
                followBottom.current =
                  node.scrollHeight - node.scrollTop - node.clientHeight < 80;
            }}
          >
            {welcome && (
              <div className="wren-welcome">
                <SparklesIcon
                  aria-hidden="true"
                  className="size-7 text-knowledge-ink"
                />
                <h2 className="font-heading text-2xl font-bold">
                  What would you like to work through?
                </h2>
                <p>
                  I’m Wren. Ask me about your past projects, explore what
                  happened, or work through a decision using their lessons. Add
                  cases for a closer look. Upload a brief or requirements file
                  to compare your current problem with the projects in Case
                  library. I search the full library unless you attach specific
                  cases.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Which past projects help us build branch purchasing?",
                    "What went wrong in the Invoice Matching Pilot?",
                    "What should we do differently next time?",
                  ].map((text) => (
                    <Button
                      key={text}
                      variant="outline"
                      className="h-auto max-w-full whitespace-normal"
                      onClick={() => {
                        setDraft(text);
                        updateDraft({ ...requestDraft, request: text });
                        input.current?.focus();
                      }}
                    >
                      {text}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {conversation?.turns.map((turn) => {
              const numbers = answerCitationNumbers(turn);
              return (
                <article key={turn.id} className="flex flex-col gap-4">
                  <div className="query-user-message">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      You
                    </p>
                    <p className="wrap-anywhere whitespace-pre-wrap">
                      {turn.message}
                    </p>
                    <MessageFiles
                      files={conversation.files ?? []}
                      ids={turn.new_file_ids ?? []}
                    />
                    {turn.context_snapshot && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {turn.context_snapshot.mode === "selected"
                          ? `${turn.context_snapshot.caseIds.length} attached case(s)`
                          : "Case library"}
                      </p>
                    )}
                  </div>
                  <WrenMessage>
                    {turn.answer?.sections.map((section, index) => (
                      <section
                        key={`${turn.id}-${index}`}
                        className="query-answer-section"
                        data-kind={section.kind}
                      >
                        {section.heading && (
                          <h3 className="mb-1 text-sm font-semibold">
                            {section.heading}
                          </h3>
                        )}
                        {section.kind === "recommendation" && (
                          <p className="mb-1 text-xs text-knowledge-ink">
                            Suggested application
                          </p>
                        )}
                        {section.kind === "inference" && (
                          <p className="mb-1 text-xs text-muted-foreground">
                            Wren’s interpretation
                          </p>
                        )}
                        <AnswerText
                          text={section.text}
                          citations={
                            !!section.evidence.length && (
                              <span className="inline-flex flex-wrap gap-1 align-middle">
                                {section.evidence.map((evidenceId) => {
                                  const evidence = turn.work?.evidence.find(
                                    (e) => e.id === evidenceId,
                                  );
                                  return evidence ? (
                                    <Citation
                                      key={evidenceId}
                                      evidence={evidence}
                                      number={
                                        numbers.get(
                                          citationKey(
                                            passageCitation(evidence),
                                          ),
                                        ) ?? 1
                                      }
                                    />
                                  ) : (
                                    (() => {
                                      const request =
                                        turn.work?.requestEvidence?.find(
                                          (e) => e.id === evidenceId,
                                        );
                                      return request ? (
                                        <CitationMarker
                                          key={evidenceId}
                                          reference={requestCitation(request)}
                                          number={
                                            numbers.get(
                                              citationKey(
                                                requestCitation(request),
                                              ),
                                            ) ?? 1
                                          }
                                        />
                                      ) : null;
                                    })()
                                  );
                                })}
                              </span>
                            )
                          }
                        />
                      </section>
                    ))}
                    {turn.work?.evidence.some((e) => e.stale) && (
                      <p className="mt-3 text-xs text-caution-foreground">
                        Some sources have changed. Inspect the current case
                        before reusing this saved answer.
                      </p>
                    )}
                    {turn.error_message && (
                      <Alert variant="caution">
                        <AlertDescription>
                          {turn.error_message}
                        </AlertDescription>
                      </Alert>
                    )}
                    {turn.status === "processing" && (
                      <output className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircleIcon
                          aria-hidden="true"
                          className="size-4 animate-spin motion-reduce:animate-none"
                        />
                        {processing
                          ? stages[turn.phase ?? "understanding"]
                          : "This turn was interrupted. Retry to resume."}
                      </output>
                    )}
                    {turn.id === latest?.id &&
                      turn.status !== "ready" &&
                      !busy && (
                        <Button
                          className="mt-3"
                          variant="outline"
                          size="sm"
                          onClick={() => void send(turn.message, turn)}
                        >
                          Retry this turn
                        </Button>
                      )}
                  </WrenMessage>
                </article>
              );
            })}
            {pending && latest?.status !== "processing" && (
              <div aria-live="polite" className="text-sm text-muted-foreground">
                {pendingMessage && pendingMessage !== latest?.message && (
                  <p className="query-user-message mb-3 whitespace-pre-wrap">
                    {pendingMessage}
                  </p>
                )}
                <WrenMessage>
                  <span className="flex items-center gap-2">
                    <LoaderCircleIcon
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    Wren is understanding your message…
                  </span>
                </WrenMessage>
              </div>
            )}
          </div>
          <form
            className="query-chat-form"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) e.preventDefault();
            }}
            onDrop={(e) => {
              if (e.dataTransfer.files.length) {
                e.preventDefault();
                addFiles(Array.from(e.dataTransfer.files));
              }
            }}
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <FileContext
              files={conversation?.files ?? []}
              disabled={busy}
              onToggle={(file) => void toggleFile(file)}
              onRetry={(file) => void retryFile(file)}
            />
            <PendingFiles
              files={uploads}
              disabled={busy}
              onRemove={(fileId) => {
                const stored = conversation?.files?.find(
                  (f) => f.id === fileId,
                );
                if (stored?.enabled) void toggleFile(stored);
                setUploads((previous) =>
                  previous.filter((f) => f.id !== fileId),
                );
              }}
            />
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <UploadFilesButton
                disabled={busy || !loaded}
                onFiles={addFiles}
              />
              <CasePicker
                selected={selected}
                disabled={busy || !loaded}
                onApply={applyCases}
              />
              <span className="text-xs text-muted-foreground">
                {context.mode === "selected"
                  ? "Using only attached cases"
                  : "Searching Case library"}
              </span>
              {context.mode === "selected" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void applyCases([]).catch((e) => setError(e.message))
                  }
                >
                  Search full library
                </Button>
              )}
            </div>
            {!!selected.length && (
              <div className="mb-3 flex flex-wrap gap-2">
                {selected.map((record) => (
                  <span
                    key={record.id}
                    className="inline-flex max-w-full items-center gap-1 rounded-control bg-knowledge px-2 py-1 text-xs text-knowledge-ink"
                  >
                    <span className="wrap-anywhere">
                      {record.title}
                      {record.is_seed ? " (fictional sample)" : ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${record.title}`}
                      disabled={busy}
                      onClick={() =>
                        void applyCases(
                          selected.filter((c) => c.id !== record.id),
                        ).catch((e) => setError(e.message))
                      }
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  </span>
                ))}
              </div>
            )}
            <div className="query-input-row">
              <label htmlFor="wren-message" className="sr-only">
                Message Wren
              </label>
              <Textarea
                id="wren-message"
                ref={input}
                value={draft}
                maxLength={10000}
                placeholder="Describe a problem, ask a question, or upload files…"
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (!id)
                    updateDraft({ ...requestDraft, request: e.target.value });
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  busy ||
                  !loaded ||
                  (!draft.trim() &&
                    !uploads.length &&
                    !conversation?.files?.some(
                      (f) => f.enabled && !f.first_turn_id,
                    ))
                }
                aria-label="Send message"
              >
                <ArrowUpIcon aria-hidden="true" />
              </Button>
            </div>
            {!id && (
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  Optional project constraints
                </summary>
                <div className="mt-3 grid gap-3">
                  {(
                    [
                      ["deadline", "Timeline"],
                      ["technology", "Technology"],
                      ["capabilities", "Capabilities"],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field} htmlFor={`constraint-${field}`}>
                      {label}
                      <Input
                        id={`constraint-${field}`}
                        className="mt-1"
                        value={requestDraft[field]}
                        maxLength={1000}
                        onChange={(e) =>
                          updateDraft({
                            ...requestDraft,
                            [field]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
            )}
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {id
                  ? "Saved for this 24-hour demo session"
                  : "Drop PDF, TXT or MD · 5 MB each · Enter to send"}
              </span>
              <Link href="/case-library" className="underline">
                Create a case
              </Link>
            </div>
          </form>
        </section>
        {hasEvidence && showEvidence && (
          <aside
            className="query-cases"
            aria-label="Sources for the latest answer"
          >
            <div className="query-case-results p-4">
              <h2 className="font-heading font-bold">Cases and evidence</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Original passages used for the latest reply
              </p>
              {work?.retrieval.warnings.map((warning) => (
                <p
                  key={warning}
                  className="mt-3 text-xs leading-relaxed text-caution-foreground"
                >
                  {warning}
                </p>
              ))}
            </div>
            {work?.retrieval.cases.map((record, index) => (
              <CaseCard
                key={record.id}
                numbers={latest ? answerCitationNumbers(latest) : new Map()}
                record={record}
                rank={index + 1}
                focused={context.caseIds.includes(record.id)}
                disabled={busy}
                onFocus={() =>
                  void applyCases([
                    {
                      id: record.id,
                      title: record.title,
                      is_seed: selected.some(
                        (c) => c.id === record.id && c.is_seed,
                      ),
                    },
                  ]).catch((e) => setError(e.message))
                }
                onRelated={() => {
                  setDraft(
                    `Which other cases in my current selection are related to ${record.title}, and why?`,
                  );
                  input.current?.focus();
                }}
              />
            ))}
          </aside>
        )}
        {welcome && <div className="wren-companion">{companion}</div>}
      </div>
    </div>
  );
}
