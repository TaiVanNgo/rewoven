"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { caseApi } from "@/features/cases/api-client";
import type { CaseSummary } from "@/features/cases/types";

export type SelectedCase = { id: string; title: string; is_seed: boolean };
export function CasePicker({
  selected,
  disabled,
  onApply,
  label = "Add cases",
}: {
  selected: SelectedCase[];
  disabled: boolean;
  onApply: (cases: SelectedCase[]) => Promise<void>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [chosen, setChosen] = useState<SelectedCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      caseApi("/api/demo-session", {
        method: "POST",
        signal: controller.signal,
      })
        .then(() =>
          caseApi<{ cases: CaseSummary[] }>(
            `/api/cases?q=${encodeURIComponent(query)}`,
            { signal: controller.signal },
          ),
        )
        .then((result) => {
          if (!controller.signal.aborted) setCases(result.cases);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setChosen(selected);
          setError("");
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!saving) setOpen(value);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add cases to this chat</DialogTitle>
            <DialogDescription>
              Choose up to five cases. Wren will use only these cases until you
              switch back to the full library.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="case-picker-search" className="sr-only">
            Search cases
          </label>
          <Input
            id="case-picker-search"
            placeholder="Search by title or content…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {chosen.length} of 5 selected
            {chosen.length ? `: ${chosen.map((c) => c.title).join(", ")}` : ""}
          </p>
          <div
            className="flex max-h-72 flex-col gap-2 overflow-y-auto"
            aria-busy={loading}
          >
            {loading && <output>Loading cases…</output>}
            {!loading && !cases.length && (
              <p className="py-5 text-sm text-muted-foreground">
                {query
                  ? "No matching cases."
                  : "No cases are available yet. Add a case in Case library."}
              </p>
            )}
            {cases.map((record) => {
              const readable = record.sources.some((s) => s.status === "ready");
              const incomplete = record.sources.some(
                (s) => s.status !== "ready" || s.indexing_status !== "ready",
              );
              const checked = chosen.some((c) => c.id === record.id);
              return (
                <label
                  key={record.id}
                  className="flex cursor-pointer items-start gap-3 rounded-control border border-border p-3 has-disabled:cursor-default has-disabled:opacity-60"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-knowledge-ink"
                    checked={checked}
                    disabled={
                      saving || (!checked && (!readable || chosen.length >= 5))
                    }
                    onChange={(e) =>
                      setChosen((previous) =>
                        e.target.checked
                          ? [
                              ...previous,
                              {
                                id: record.id,
                                title: record.title,
                                is_seed: record.is_seed,
                              },
                            ]
                          : previous.filter((c) => c.id !== record.id),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold wrap-anywhere">
                      {record.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {record.is_seed ? "Fictional sample · " : ""}
                      {!readable
                        ? "No readable sources — finish processing in Case library"
                        : incomplete
                          ? "Some documents are not fully indexed"
                          : `${record.sources.length} source document(s)`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Link
              href="/case-library"
              className="mr-auto self-center text-sm underline"
            >
              Create a case
            </Link>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={saving || disabled}
              onClick={async () => {
                setSaving(true);
                setError("");
                try {
                  await onApply(chosen);
                  setOpen(false);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not update selection.",
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Applying…" : "Apply selection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
