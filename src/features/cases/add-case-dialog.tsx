"use client";

import {
  CheckIcon,
  FileUpIcon,
  LoaderCircleIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
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
import {
  type CaseAnalysis,
  SUGGESTION_FIELDS,
  type SuggestionField,
} from "./case-suggestions";
import { CASE_FIELD_LABELS, SuggestionEvidence } from "./suggestion-evidence";
import { type CaseDetail, MAX_SOURCE_CHARS } from "./types";
import { validateFile, validateText } from "./validation";

export function AddCaseDialog({
  disabled,
  onCreated,
}: {
  disabled: boolean;
  onCreated: (record: CaseDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reading, setReading] = useState(false);
  const [mode, setMode] = useState("file");
  const [draft, setDraft] = useState(emptyCaseDraft);
  const [file, setFile] = useState<File | null>(null);
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
  const sourceReady =
    mode === "file" ? !!file : !!fields.text.trim() && !tooLong;

  function update(name: keyof typeof fields, value: string) {
    if (busyRef.current) return;
    setDraft((current) => editCaseDraft(current, name, value));
    requestKey.current = null;
  }
  function invalidateAnalysis() {
    setDraft(invalidateCaseDraft);
    if (analysis) setSourceNotice(true);
    setAnalysis(null);
    setAIError("");
    setError("");
    requestKey.current = null;
  }
  function chooseFile(candidate: File | undefined) {
    if (!candidate || busyRef.current) return;
    invalidateAnalysis();
    setSourceError("");
    setFile(null);
    if (input.current) input.current.value = "";
    try {
      validateFile(candidate.name, candidate.size);
      setFile(candidate);
    } catch (error) {
      setSourceError(
        error instanceof Error
          ? error.message
          : "Choose a supported source file.",
      );
    }
  }
  function sourceForm() {
    if (mode === "text") validateText(fields.text);
    else if (!file) throw new Error("Choose a source file.");
    else validateFile(file.name, file.size);
    const body = new FormData();
    body.set("mode", mode);
    if (mode === "text") body.set("text", fields.text);
    else if (file) body.set("file", file);
    return body;
  }
  async function readSource() {
    if (busyRef.current) return;
    setAIError("");
    try {
      const body = sourceForm();
      busyRef.current = true;
      setReading(true);
      const result = await caseApi<CaseAnalysis>("/api/cases/analyze", {
        method: "POST",
        body,
      });
      setAnalysis(result);
      setDraft((current) => fillCaseDraft(current, result.suggestions));
      setSourceNotice(false);
      requestKey.current = null;
      reviewHeading.current?.focus();
    } catch (error) {
      setAIError(
        error instanceof Error
          ? error.message
          : "AI reading could not finish. Try again or enter the fields manually.",
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
      if (!fields.title.trim()) throw new Error("Enter a case title.");
      const body = sourceForm();
      requestKey.current ??= crypto.randomUUID();
      body.set("requestKey", requestKey.current);
      for (const name of SUGGESTION_FIELDS) body.set(name, fields[name]);
      if (analysis) body.set("analysisId", analysis.id);
      busyRef.current = true;
      setPending(true);
      const result = await caseApi<{ case: CaseDetail }>("/api/cases", {
        method: "POST",
        body,
      });
      onCreated(result.case);
      if (
        result.case.status === "failed" &&
        result.case.error_message?.startsWith("The original upload")
      ) {
        requestKey.current = null;
        setError(result.case.error_message);
        return;
      }
      setOpen(false);
      setDraft(emptyCaseDraft());
      setFile(null);
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
        if (!busyRef.current) setOpen(next);
      }}
    >
      <DialogTrigger render={<Button disabled={disabled} />}>
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        Add case
      </DialogTrigger>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-[620px]"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Add a case</DialogTitle>
          <DialogDescription>
            Start with a source. Read it with AI or enter the details yourself,
            then review before saving.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <form
          onSubmit={submit}
          className="flex min-w-0 flex-col gap-5"
          aria-busy={pending}
        >
          <FieldSet disabled={busy}>
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
                      Upload file
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
                      {fields.text.length.toLocaleString()} / 50,000 characters.
                      The original text is preserved when you confirm.
                    </FieldDescription>
                    {tooLong && (
                      <FieldError>
                        Source text exceeds 50,000 characters. Split it into
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
                      accept=".txt,.md,.pdf"
                      onChange={(e) => chooseFile(e.target.files?.[0])}
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
                        if (event.dataTransfer.files.length !== 1) {
                          setSourceError("Choose one file per case.");
                          return;
                        }
                        chooseFile(event.dataTransfer.files[0]);
                      }}
                    >
                      <FileUpIcon data-icon="inline-start" aria-hidden="true" />
                      <span className="max-w-full truncate">
                        {file ? file.name : "Choose a file or drag it here"}
                      </span>
                      <span className="text-xs font-normal">
                        .txt, .md, or text-based .pdf
                      </span>
                    </Button>
                    {file && (
                      <FieldDescription className="wrap-anywhere">
                        Selected: {file.name} ({(file.size / 1000).toFixed(1)}{" "}
                        KB)
                      </FieldDescription>
                    )}
                    <FieldDescription id="case-file-help">
                      Up to 5 MB and 50,000 extracted characters. Scanned PDFs
                      and image interpretation are not supported.
                    </FieldDescription>
                    {sourceError && <FieldError>{sourceError}</FieldError>}
                  </Field>
                </TabsContent>
              </Tabs>
              <div className="flex flex-col items-start gap-2">
                <Button
                  type="button"
                  variant="outline"
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
                    ? "Reading source…"
                    : aiError
                      ? "Retry AI reading"
                      : "Read with AI"}
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Sends source text to OpenAI to suggest the fields below. AI
                  use is billed to the project's API account. You can also fill
                  the fields manually.
                </p>
              </div>
            </FieldGroup>
          </FieldSet>
          {reading && (
            <output
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              Reading source text and checking suggestions against its evidence.
              This may take up to a minute.
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
            <Alert role="status">
              <CheckIcon aria-hidden="true" />
              <AlertTitle>Ready for your review</AlertTitle>
              <AlertDescription>
                Read{" "}
                {analysis.isPdf
                  ? `${analysis.pageCount} PDF pages`
                  : "source text"}
                . Blank fields were filled where evidence was found; your
                existing text was kept. Check each suggestion before confirming.
              </AlertDescription>
            </Alert>
          )}
          {analysis && analysis.warnings.length > 0 && (
            <Alert variant="caution">
              <AlertTitle>Some content is unavailable</AlertTitle>
              <AlertDescription>{analysis.warnings.join(" ")}</AlertDescription>
            </Alert>
          )}
          <Separator />
          <h3
            ref={reviewHeading}
            tabIndex={-1}
            className="font-heading font-semibold outline-none"
          >
            Review case details
          </h3>
          <FieldSet disabled={busy}>
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
              Storing the original and processing its text. Keep this dialog
              open.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            AI suggestions and quotes are kept separately from your final edits
            when you confirm. Unfinished sources and form edits are lost on
            refresh.
          </p>
          <Separator />
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !fields.title.trim() || !sourceReady}
            >
              {pending && (
                <LoaderCircleIcon
                  className="animate-spin motion-reduce:animate-none"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
              )}
              {pending ? "Adding case…" : "Confirm & add case"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
