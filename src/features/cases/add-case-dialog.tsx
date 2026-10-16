"use client";

import {
  CheckIcon,
  FileUpIcon,
  LoaderCircleIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { caseApi } from "./api-client";
import {
  applyCaseSuggestion,
  editCaseDraft,
  emptyCaseDraft,
  fillCaseDraft,
  invalidateCaseDraft,
} from "./case-draft";
import { caseFields } from "./case-reading";
import {
  type CaseAnalysis,
  SUGGESTION_FIELDS,
  type SuggestionField,
} from "./case-suggestions";
import { readCaseDocuments } from "./read-case";
import { CASE_FIELD_LABELS, SuggestionEvidence } from "./suggestion-evidence";
import { type CaseDetail, MAX_SOURCE_CHARS } from "./types";
import { type PendingUpload, uploadFiles } from "./upload-sources";
import { validateFile, validateText } from "./validation";

function entryDraft(record?: CaseDetail) {
  const draft = emptyCaseDraft();
  if (record)
    Object.assign(draft.fields, caseFields(record), {
      title: record.title === "AI reading in progress" ? "" : record.title,
    });
  return draft;
}

export function AddCaseDialog({
  disabled,
  onCreated,
  caseId,
  existingSources = [],
  existingCase,
  readExisting = false,
}: {
  caseId?: string;
  existingSources?: CaseDetail["sources"];
  existingCase?: CaseDetail;
  readExisting?: boolean;
  disabled: boolean;
  onCreated: (record: CaseDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reading, setReading] = useState(false);
  const [mode, setMode] = useState("file");
  const [draft, setDraft] = useState(() => entryDraft(existingCase));
  const [manualEntry, setManualEntry] = useState(false);
  const [readingProgress, setReadingProgress] = useState("");
  const [expected, setExpected] = useState<Record<string, string> | null>(() =>
    existingCase ? caseFields(existingCase) : null,
  );
  const stopped = useRef(false);
  const pastedSourceKey = useRef<string | null>(null);
  useEffect(
    () => () => {
      stopped.current = true;
    },
    [],
  );
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CaseAnalysis | null>(null);
  const [error, setError] = useState("");
  const [aiError, setAIError] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [sourceNotice, setSourceNotice] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const requestKey = useRef<string | null>(null);
  const busyRef = useRef(false);
  const { fields, applied } = draft;
  const busy = pending || reading;
  const tooLong = fields.text.length > MAX_SOURCE_CHARS;
  const sourceReady = readExisting
    ? existingSources.length > 0
    : mode === "file"
      ? uploads.length > 0
      : !!fields.text.trim() && !tooLong;

  function update(name: keyof typeof fields, value: string) {
    if (busyRef.current) return;
    setDraft((current) => editCaseDraft(current, name, value));
    requestKey.current = null;
  }
  function invalidateAnalysis() {
    pastedSourceKey.current = null;
    setDraft(invalidateCaseDraft);
    if (analysis) setSourceNotice(true);
    setAnalysis(null);
    setAIError("");
    setError("");
    requestKey.current = null;
  }
  function chooseFiles(candidates: File[]) {
    if (busyRef.current) return;
    invalidateAnalysis();
    setSourceError("");
    const accepted: PendingUpload[] = [];
    const errors: string[] = [];
    for (const candidate of candidates) {
      try {
        validateFile(candidate.name, candidate.size);
        accepted.push({
          key: crypto.randomUUID(),
          file: candidate,
          state: "selected",
        });
      } catch (error) {
        errors.push(
          `${candidate.name}: ${error instanceof Error ? error.message : "Invalid file"}`,
        );
      }
    }
    if (accepted.length + existingSources.length > 50) {
      setSourceError("Choose at most 50 documents per case.");
      return;
    }
    if (
      accepted.reduce((n, item) => n + item.file.size, 0) +
        existingSources.reduce((n, source) => n + (source.byte_size ?? 0), 0) >
      100_000_000
    ) {
      setSourceError(
        "Case limit: 100 MB of original material, including retained sources.",
      );
      return;
    }
    setUploads(accepted);
    setSourceError(errors.join(" "));
    if (input.current) input.current.value = "";
  }
  function updateUpload(key: string, patch: Partial<PendingUpload>) {
    setUploads((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }
  async function prepareSources() {
    if (!sourceReady)
      throw new Error("Choose documents or paste source text first.");
    requestKey.current ??= crypto.randomUUID();
    let target = caseId ?? createdId;
    if (!target) {
      const result = await caseApi<{ case: CaseDetail }>("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: requestKey.current,
          ...caseFields({
            ...fields,
            title: fields.title.trim() || "AI reading in progress",
          }),
        }),
      });
      target = result.case.id;
      setCreatedId(target);
      setExpected(caseFields(result.case));
    }
    if (!readExisting) {
      if (mode === "text") {
        validateText(fields.text);
        pastedSourceKey.current ??= crypto.randomUUID();
        const source = await caseApi<{ sourceId: string }>(
          `/api/cases/${target}/sources`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestKey: pastedSourceKey.current,
              title: "Pasted source.txt",
              text: fields.text,
            }),
          },
        );
        await caseApi(`/api/sources/${source.sourceId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      } else {
        const batch = await uploadFiles(target, uploads, updateUpload);
        if (batch.failed > 0)
          throw new Error(
            "Some files did not finish uploading. Retry to resume them; completed documents are preserved.",
          );
      }
    }
    const result = await caseApi<{ case: CaseDetail }>(`/api/cases/${target}`);
    const currentFields = caseFields(result.case);
    if (
      expected &&
      Object.entries(currentFields).some(
        ([name, value]) => expected[name] !== value,
      )
    )
      throw new Error(
        "The saved case details changed. Reopen the case before reading to preserve the latest edits.",
      );
    setExpected(currentFields);
    return target;
  }
  async function readSource() {
    if (busyRef.current) return;
    busyRef.current = true;
    stopped.current = false;
    setReading(true);
    setAIError("");
    setReadingProgress("Uploading and preparing documents…");
    try {
      const target = await prepareSources();
      const result = await readCaseDocuments(
        target,
        setReadingProgress,
        () => {},
        () => stopped.current,
      );
      if (stopped.current) return;
      setAnalysis(result);
      setDraft((current) => fillCaseDraft(current, result.suggestions));
      setSourceNotice(false);
      const record = await caseApi<{ case: CaseDetail }>(
        `/api/cases/${target}`,
      );
      onCreated(record.case);
      reviewHeading.current?.focus();
    } catch (error) {
      setAIError(
        error instanceof Error
          ? error.message
          : "AI reading could not finish. Retry saved progress.",
      );
    } finally {
      busyRef.current = false;
      setReading(false);
    }
  }
  function applySuggestion(field: SuggestionField) {
    if (!analysis || busyRef.current) return;
    setDraft((current) =>
      applyCaseSuggestion(current, field, analysis.suggestions[field].value),
    );
    requestKey.current = null;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    setError("");
    try {
      if (analysis?.caseId && expected) {
        busyRef.current = true;
        setPending(true);
        const result = await caseApi<{ case: CaseDetail }>(
          `/api/cases/${analysis.caseId}/review`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              readingId: analysis.id,
              fields: caseFields(fields),
              expected,
            }),
          },
        );
        onCreated(result.case);
        setOpen(false);
        setCreatedId(null);
        setAnalysis(null);
        setUploads([]);
        setDraft(entryDraft(caseId ? result.case : undefined));
        setManualEntry(false);
        pastedSourceKey.current = null;
        setExpected(caseId ? caseFields(result.case) : null);
        requestKey.current = null;
        return;
      }
      if (!caseId && !fields.title.trim())
        throw new Error("Enter a case title.");
      if (
        mode === "text" &&
        (existingSources.length >= 50 ||
          existingSources.reduce((n, s) => n + s.char_count, 0) +
            fields.text.length >
            5_000_000)
      )
        throw new Error(
          "Case limit: 50 documents and 5,000,000 extracted characters.",
        );
      if (!sourceReady)
        throw new Error("Choose source documents or paste text.");
      busyRef.current = true;
      setPending(true);
      requestKey.current ??= crypto.randomUUID();
      let target = caseId ?? createdId;
      if (!target) {
        const result = await caseApi<{ case: CaseDetail }>("/api/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestKey: requestKey.current,
            ...Object.fromEntries(
              SUGGESTION_FIELDS.map((name) => [name, fields[name]]),
            ),
          }),
        });
        target = result.case.id;
        setCreatedId(target);
      }
      let uploadFailed = false;
      if (mode === "text") {
        validateText(fields.text);
        pastedSourceKey.current ??= crypto.randomUUID();
        const reserved = await caseApi<{ sourceId: string }>(
          `/api/cases/${target}/sources`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestKey: pastedSourceKey.current,
              title: "Pasted source.txt",
              text: fields.text,
            }),
          },
        );
        await caseApi(`/api/sources/${reserved.sourceId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisId: analysis?.id }),
        });
      } else {
        const batch = await uploadFiles(
          target,
          uploads,
          updateUpload,
          analysis?.id,
        );
        uploadFailed = batch.failed > 0;
      }
      const result = await caseApi<{ case: CaseDetail }>(
        `/api/cases/${target}`,
      );
      if (!caseId && createdId && expected) {
        const saved = await caseApi<{ case: CaseDetail }>(
          `/api/cases/${target}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields: caseFields(fields), expected }),
          },
        );
        result.case = saved.case;
        setExpected(caseFields(saved.case));
      }
      onCreated(result.case);
      const failed = result.case.sources.some(
        (source) => source.status === "uploading",
      );
      if (failed || uploadFailed) {
        setError(
          "Some files did not finish uploading. Retry to resume them; other documents are preserved.",
        );
        return;
      }
      setOpen(false);
      setCreatedId(null);
      setUploads([]);
      setDraft(entryDraft(caseId ? result.case : undefined));
      setExpected(caseId ? caseFields(result.case) : null);
      setManualEntry(false);
      pastedSourceKey.current = null;
      setAnalysis(null);
      setSourceError("");
      setAIError("");
      setSourceNotice(false);
      requestKey.current = null;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not add the case. Your form is preserved.",
      );
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          if (!next) stopped.current = true;
          setOpen(next);
        }
      }}
    >
      <DialogTrigger render={<Button disabled={disabled} />}>
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        {readExisting
          ? "Read case with AI"
          : caseId
            ? "Add documents"
            : "Add case"}
      </DialogTrigger>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-[620px]"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>
            {readExisting
              ? "Read case with AI"
              : caseId
                ? "Add documents"
                : "Add a case"}
          </DialogTitle>
          <DialogDescription>
            Upload your project documents and let AI fill in the case details.
            Review the suggestions and source evidence before saving.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <form
          onSubmit={submit}
          className="flex min-w-0 flex-col gap-5"
          aria-busy={pending}
        >
          <FieldSet disabled={busy} hidden={readExisting}>
            <FieldGroup>
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  if (busyRef.current) return;
                  invalidateAnalysis();
                  setMode(String(value));
                  setSourceError("");
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-heading font-semibold">
                    Source evidence
                  </h3>
                  <TabsList aria-label="Source evidence format">
                    <TabsTrigger value="text" disabled={busy}>
                      Paste text
                    </TabsTrigger>
                    <TabsTrigger value="file" disabled={busy}>
                      Upload files
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="text">
                  <Field data-invalid={tooLong}>
                    <FieldLabel htmlFor="case-source">
                      Original source text
                    </FieldLabel>
                    <Textarea
                      id="case-source"
                      rows={6}
                      placeholder="Paste the original notes, brief, or retrospective."
                      value={fields.text}
                      onChange={(e) => {
                        invalidateAnalysis();
                        update("text", e.target.value);
                      }}
                      aria-invalid={tooLong}
                      aria-describedby="case-source-help"
                    />
                    <FieldDescription id="case-source-help">
                      {fields.text.length.toLocaleString()} / 500,000
                      characters. The original text is preserved when you
                      confirm.
                    </FieldDescription>
                    {tooLong && (
                      <FieldError>
                        Source text exceeds 500,000 characters. Split it into
                        smaller documents.
                      </FieldError>
                    )}
                  </Field>
                </TabsContent>
                <TabsContent value="file">
                  <Field data-invalid={!!sourceError}>
                    <FieldLabel htmlFor="case-file">Source file</FieldLabel>
                    <Input
                      ref={input}
                      id="case-file"
                      hidden
                      type="file"
                      multiple
                      accept=".txt,.md,.pdf"
                      onChange={(e) =>
                        chooseFiles(Array.from(e.target.files ?? []))
                      }
                      aria-invalid={!!sourceError}
                      aria-describedby="case-file-help"
                    />
                    <Button
                      type="button"
                      variant="upload"
                      disabled={busy}
                      onClick={() => input.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (busyRef.current) return;
                        chooseFiles(Array.from(event.dataTransfer.files));
                      }}
                    >
                      <FileUpIcon data-icon="inline-start" aria-hidden="true" />
                      <span className="max-w-full truncate">
                        {uploads.length
                          ? `${uploads.length} document(s) selected`
                          : "Choose files or drag them here"}
                      </span>
                      <span className="text-xs font-normal">
                        .txt, .md, or text-based .pdf
                      </span>
                    </Button>
                    {uploads.length > 0 && (
                      <ul
                        className="flex flex-col gap-2 text-sm"
                        aria-live="polite"
                      >
                        {uploads.map((item) => (
                          <li key={item.key} className="wrap-anywhere">
                            {item.file.name} ·{" "}
                            {(item.file.size / 1000).toFixed(1)} KB ·{" "}
                            {item.state}
                            {item.error && (
                              <p className="text-destructive">{item.error}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <FieldDescription id="case-file-help">
                      Up to 50 documents, 5 MB and 500,000 extracted characters
                      per document. Scanned PDFs and image interpretation are
                      not supported.
                    </FieldDescription>
                    {sourceError && <FieldError>{sourceError}</FieldError>}
                  </Field>
                </TabsContent>
              </Tabs>
              <div className="flex flex-col items-start gap-2">
                <Button
                  type="button"
                  variant="default"
                  disabled={busy || !sourceReady}
                  onClick={readSource}
                >
                  {reading ? (
                    <LoaderCircleIcon
                      className="animate-spin motion-reduce:animate-none"
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                  ) : (
                    <SparklesIcon data-icon="inline-start" aria-hidden="true" />
                  )}
                  {reading
                    ? "Reading documents…"
                    : aiError
                      ? "Retry AI reading"
                      : "Read documents with AI"}
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Reads all accepted documents in saved stages: up to 500,000
                  characters per document and 5,000,000 per case. AI use is
                  billed to the project's API account. You can still enter
                  details yourself.
                </p>
              </div>
            </FieldGroup>
          </FieldSet>
          {readExisting && (
            <Button
              type="button"
              onClick={readSource}
              disabled={busy || !sourceReady}
            >
              {reading
                ? "Reading documents…"
                : aiError
                  ? "Retry saved reading"
                  : "Read all case documents"}
            </Button>
          )}
          {reading && (
            <output
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {readingProgress} Each AI step may take up to a minute; larger
              cases need several steps. Closing this dialog pauses after the
              current step.
            </output>
          )}
          {aiError && (
            <Alert variant="destructive">
              <AlertTitle>AI reading could not finish</AlertTitle>
              <AlertDescription>
                {aiError} Your source and form are preserved.
              </AlertDescription>
            </Alert>
          )}
          {sourceNotice && (
            <Alert variant="caution">
              <AlertTitle>Source changed</AlertTitle>
              <AlertDescription>
                Previous suggestions were cleared. Your edits were kept; check
                them against the new source.
              </AlertDescription>
            </Alert>
          )}
          {analysis && (
            <Alert>
              <CheckIcon aria-hidden="true" />
              <AlertTitle>Ready for your review</AlertTitle>
              <AlertDescription>
                Read {analysis.sourceIds?.length ?? 1} document(s) across{" "}
                {analysis.pageCount} extracted page(s) . Blank fields were
                filled where evidence was found; your existing text was kept.
                Check each suggestion before confirming.
              </AlertDescription>
            </Alert>
          )}
          {analysis && analysis.warnings.length > 0 && (
            <Alert variant="caution">
              <AlertTitle>Reading notes and limitations</AlertTitle>
              <AlertDescription>{analysis.warnings.join(" ")}</AlertDescription>
            </Alert>
          )}
          <Separator />
          {!analysis && !manualEntry && !caseId && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setManualEntry(true)}
            >
              Enter details yourself instead
            </Button>
          )}
          <h3
            hidden={!analysis && !manualEntry}
            ref={reviewHeading}
            tabIndex={-1}
            className="font-heading font-semibold outline-none"
          >
            Review case details
          </h3>
          <FieldSet
            disabled={busy || (!analysis && !manualEntry)}
            hidden={!analysis && !manualEntry}
          >
            <FieldGroup>
              {SUGGESTION_FIELDS.map((field) => {
                const suggestion = analysis?.suggestions[field];
                const isApplied = applied[field] !== undefined;
                const unused =
                  !!suggestion?.value && fields[field] !== suggestion.value;
                return (
                  <Field key={field}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <FieldLabel htmlFor={`case-${field}`}>
                        {CASE_FIELD_LABELS[field]}{" "}
                        {field === "title" ? (
                          <span aria-hidden="true">*</span>
                        ) : (
                          <span className="font-normal text-muted-foreground">
                            (optional)
                          </span>
                        )}
                      </FieldLabel>
                      {suggestion?.value && (
                        <Badge variant={isApplied ? "default" : "outline"}>
                          {isApplied
                            ? "AI suggestion · Editable"
                            : "Your text · Editable"}
                        </Badge>
                      )}
                    </div>
                    {field === "title" ? (
                      <Input
                        id="case-title"
                        required
                        maxLength={200}
                        placeholder="e.g., Vendor Billing Portal"
                        value={fields.title}
                        onChange={(e) => update("title", e.target.value)}
                      />
                    ) : (
                      <Textarea
                        id={`case-${field}`}
                        maxLength={5000}
                        rows={field === "context" ? 3 : 2}
                        placeholder={
                          field === "context"
                            ? "What was the project, and what problem did it solve?"
                            : field === "outcome"
                              ? "Leave blank if the outcome was not recorded."
                              : "What lessons or caveats did the team document?"
                        }
                        value={fields[field]}
                        onChange={(e) => update(field, e.target.value)}
                      />
                    )}
                    {unused && (
                      <div className="flex flex-col items-start gap-2 text-sm">
                        <p className="wrap-anywhere text-muted-foreground">
                          AI suggested: {suggestion.value}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => applySuggestion(field)}
                          aria-label={`Use AI suggestion for ${CASE_FIELD_LABELS[field].toLowerCase()}`}
                        >
                          Use suggestion
                        </Button>
                      </div>
                    )}
                    {suggestion && (
                      <SuggestionEvidence evidence={suggestion.evidence} />
                    )}
                    {analysis && !suggestion?.value && (
                      <FieldDescription>
                        No supported suggestion found. You can supply recorded
                        information yourself.
                      </FieldDescription>
                    )}
                  </Field>
                );
              })}
            </FieldGroup>
          </FieldSet>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Could not add the case</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {pending && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Saving the reviewed case and its original documents.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            AI drafts and source quotes are saved separately from your final
            edits when you confirm. Uploaded documents survive refresh; pending
            local files and unsaved form edits need to be supplied again.
          </p>
          <Separator />
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                stopped.current = true;
                setOpen(false);
              }}
            >
              {reading ? "Pause reading" : "Close"}
            </Button>
            <Button
              type="submit"
              disabled={
                busy ||
                (!caseId && !fields.title.trim()) ||
                !sourceReady ||
                (readExisting && !analysis)
              }
            >
              {pending && (
                <LoaderCircleIcon
                  className="animate-spin motion-reduce:animate-none"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
              )}
              {pending
                ? "Saving…"
                : analysis?.caseId
                  ? "Confirm case details"
                  : caseId
                    ? "Add documents"
                    : "Confirm & add case"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
