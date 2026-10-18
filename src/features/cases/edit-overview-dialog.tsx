"use client";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { caseApi } from "./api-client";
import {
  type CaseOverview,
  emptyOverview,
  OVERVIEW_KEYS,
} from "./case-overview";
import { caseFields } from "./case-reading";
import { OverviewEditor } from "./overview-editor";
import type { CaseDetail } from "./types";

export function EditOverviewDialog({
  record,
  onSaved,
}: {
  record: CaseDetail;
  onSaved: (record: CaseDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [overview, setOverview] = useState<CaseOverview>(
    record.overview ?? emptyOverview(),
  );
  const [title, setTitle] = useState(record.title);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // The dialog keeps this snapshot until closed; background refreshes cannot
  // silently move the optimistic-lock baseline while a person is editing.
  const [baseline, setBaseline] = useState(record);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) {
          setBaseline(record);
          setOverview(structuredClone(record.overview ?? emptyOverview()));
          setTitle(record.title);
          setError("");
        }
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        Edit case
      </DialogTrigger>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>Edit case</DialogTitle>
          <DialogDescription>
            Your changes are saved separately from the original AI reading.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            try {
              const cleaned = structuredClone(overview);
              for (const key of OVERVIEW_KEYS)
                cleaned.sections[key] = cleaned.sections[key].filter((f) =>
                  f.text.trim(),
                );
              const result = await caseApi<{ case: CaseDetail }>(
                `/api/cases/${record.id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    fields: { ...caseFields(baseline), title },
                    expected: caseFields(baseline),
                    // A title-only edit on an older case must not project an
                    // empty overview over its saved context/outcome/lessons.
                    ...(baseline.overview ||
                    OVERVIEW_KEYS.some((key) => cleaned.sections[key].length)
                      ? {
                          overview: cleaned,
                          expectedOverviewRevision:
                            baseline.overviewRevision ?? 0,
                        }
                      : {}),
                  }),
                },
              );
              onSaved(result.case);
              setOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Saving failed.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Field>
            <FieldLabel htmlFor="overview-case-title">Case title</FieldLabel>
            <Input
              id="overview-case-title"
              required
              maxLength={200}
              value={title}
              disabled={pending}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <OverviewEditor
            value={overview}
            onChange={setOverview}
            disabled={pending}
            prefix="edit"
          />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    const fresh = await caseApi<{ case: CaseDetail }>(
                      `/api/cases/${record.id}`,
                    );
                    setBaseline(fresh.case);
                    setOverview(
                      structuredClone(fresh.case.overview ?? emptyOverview()),
                    );
                    setTitle(fresh.case.title);
                    onSaved(fresh.case);
                    setError("");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Reload failed.");
                  }
                }}
              >
                Reload saved overview
              </Button>
            </Alert>
          )}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save overview"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
