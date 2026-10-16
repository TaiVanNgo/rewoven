"use client";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AddCaseDialog } from "./add-case-dialog";
import { caseApi } from "./api-client";
import { CaseListSkeleton } from "./case-skeleton";
import { CaseStatusBadge } from "./case-status";
import { useCaseWorkspace } from "./case-workspace";
import type { CaseSummary } from "./types";

export function CaseLibrary() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const legacyCase = params.get("case");
  const [input, setInput] = useState(query);
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState("");
  const {
    ready,
    revision,
    error: workspaceError,
    retry,
    refresh,
  } = useCaseWorkspace();
  useEffect(() => {
    if (!legacyCase) return;
    const next = new URLSearchParams(params);
    next.delete("case");
    router.replace(`/case-library/${encodeURIComponent(legacyCase)}?${next}`);
  }, [legacyCase, params, router]);
  useEffect(() => {
    setInput(query);
  }, [query]);
  useEffect(() => {
    if (input === query) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams();
      if (input) next.set("q", input);
      router.replace(`/case-library${next.size ? `?${next}` : ""}`, {
        scroll: false,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [input, query, router]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision refreshes after document processing.
  useEffect(() => {
    if (!ready || legacyCase) return;
    const controller = new AbortController();
    setError("");
    void caseApi<{ cases: CaseSummary[] }>(
      `/api/cases?q=${encodeURIComponent(query)}`,
      { signal: controller.signal },
    )
      .then((r) => {
        if (!controller.signal.aborted) setCases(r.cases);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [ready, query, revision, legacyCase]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Field className="max-w-md">
          <FieldLabel htmlFor="case-search">
            Search cases and source text
          </FieldLabel>
          <Input
            id="case-search"
            type="search"
            placeholder="Search the archive…"
            maxLength={200}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </Field>
        <AddCaseDialog
          disabled={!ready}
          onPrepared={() => refresh()}
          onCreated={(record) => router.push(`/case-library/${record.id}`)}
        />
      </div>
      {(error || workspaceError) && (
        <Alert variant="caution">
          <AlertDescription>{error || workspaceError}</AlertDescription>
          <Button
            variant="outline"
            onClick={() => {
              retry();
              setError("");
            }}
          >
            Try again
          </Button>
        </Alert>
      )}
      {!cases || legacyCase ? (
        <CaseListSkeleton />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {cases.length} {query ? "matching" : "available"} cases
          </p>
          {!cases.length && (
            <p className="rounded-panel bg-muted p-8">
              {query
                ? "No matching cases. Try a word from the project or its documents."
                : "Add a case to start your archive."}
            </p>
          )}
          <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {cases.map((record) => (
              <Link
                key={record.id}
                prefetch={false}
                href={`/case-library/${record.id}${query ? `?q=${encodeURIComponent(query)}` : ""}`}
                className={`${buttonVariants({ variant: "case" })} h-auto! min-w-0 items-stretch! gap-3! p-6!`}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline">
                    {record.is_seed ? "Fictional sample" : "Your case"}
                  </Badge>
                  <CaseStatusBadge status={record.status} />
                </span>
                <h2 className="font-heading text-lg font-bold wrap-anywhere">
                  {record.title}
                </h2>
                <p className="line-clamp-3 text-sm leading-relaxed font-normal text-muted-foreground">
                  {record.context ||
                    "Inspect the sources or prepare a project overview."}
                </p>
                <span className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs font-normal">
                  <span className="flex items-center gap-1">
                    <FileTextIcon aria-hidden="true" className="size-4" />
                    {record.sources.length}{" "}
                    {record.sources.length === 1 ? "source" : "sources"}
                  </span>
                  <span>
                    {record.outcome
                      ? "Result documented"
                      : "Outcome not recorded"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
