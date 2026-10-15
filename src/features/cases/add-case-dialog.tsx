"use client";

import { FileUpIcon, LoaderCircleIcon, PlusIcon } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const [mode, setMode] = useState("file");
  const [fields, setFields] = useState({
    title: "",
    context: "",
    outcome: "",
    lessons: "",
    text: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [sourceError, setSourceError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const requestKey = useRef<string | null>(null);
  const tooLong = fields.text.length > MAX_SOURCE_CHARS;
  function update(name: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    requestKey.current = null;
  }
  function chooseFile(candidate: File | undefined) {
    requestKey.current = null;
    setSourceError("");
    setFile(null);
    if (!candidate) return;
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    try {
      if (!fields.title.trim()) throw new Error("Enter a case title.");
      if (mode === "text") validateText(fields.text);
      else if (!file) throw new Error("Choose a source file.");
      if (file && mode === "file") validateFile(file.name, file.size);
      requestKey.current ??= crypto.randomUUID();
      const body = new FormData();
      body.set("requestKey", requestKey.current);
      body.set("mode", mode);
      for (const [name, value] of Object.entries(fields)) body.set(name, value);
      if (mode === "file" && file) body.set("file", file);
      setPending(true);
      const result = await caseApi<{ case: CaseDetail }>("/api/cases", {
        method: "POST",
        body,
      });
      onCreated(result.case);
      // A failed upload has no retained original: keep the contributor's draft for another attempt.
      if (
        result.case.status === "failed" &&
        result.case.error_message?.startsWith("The original upload")
      ) {
        requestKey.current = null;
        setError(result.case.error_message);
        return;
      }
      setOpen(false);
      setFields({ title: "", context: "", outcome: "", lessons: "", text: "" });
      setFile(null);
      setSourceError("");
      requestKey.current = null;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not add the case. Your form is preserved.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger render={<Button disabled={disabled} />}>
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        Add case
      </DialogTrigger>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-[560px]"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>Add a case</DialogTitle>
          <DialogDescription>
            Add past work and its original sources.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <form
          onSubmit={submit}
          className="flex flex-col gap-5"
          aria-busy={pending}
        >
          <FieldSet disabled={pending}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="case-title">
                  Case title <span aria-hidden="true">*</span>
                </FieldLabel>
                <Input
                  id="case-title"
                  required
                  maxLength={200}
                  placeholder="e.g., Vendor Billing Portal"
                  value={fields.title}
                  onChange={(e) => update("title", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="case-context">
                  Context{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FieldLabel>
                <Textarea
                  id="case-context"
                  maxLength={5000}
                  rows={3}
                  placeholder="What was the project, and what problem did it solve?"
                  value={fields.context}
                  onChange={(e) => update("context", e.target.value)}
                />
              </Field>
              <Separator />
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  setMode(String(value));
                  setSourceError("");
                  requestKey.current = null;
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-heading font-semibold">
                    Source evidence
                  </span>
                  <TabsList aria-label="Source evidence format">
                    <TabsTrigger value="text" disabled={pending}>
                      Paste text
                    </TabsTrigger>
                    <TabsTrigger value="file" disabled={pending}>
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
                      rows={7}
                      placeholder="Paste the original notes, brief, or retrospective."
                      value={fields.text}
                      onChange={(e) => update("text", e.target.value)}
                      aria-invalid={tooLong}
                      aria-describedby="case-source-help"
                    />
                    <FieldDescription id="case-source-help">
                      {fields.text.length.toLocaleString()} / 50,000 characters.
                      Text is preserved as supplied.
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
                      disabled={pending}
                      onClick={() => input.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (pending) return;
                        if (event.dataTransfer.files.length !== 1) {
                          setSourceError("Choose one file per case.");
                          return;
                        }
                        chooseFile(event.dataTransfer.files[0]);
                      }}
                    >
                      <FileUpIcon data-icon="inline-start" aria-hidden="true" />
                      <span>
                        {file ? file.name : "Choose a file or drag it here"}
                      </span>
                      <span className="text-xs font-normal">
                        .txt, .md, or text-based .pdf
                      </span>
                    </Button>
                    {file && (
                      <FieldDescription>
                        Selected: {file.name} ({(file.size / 1000).toFixed(1)}{" "}
                        KB)
                      </FieldDescription>
                    )}
                    <FieldDescription id="case-file-help">
                      Up to 5 MB. Maximum 50,000 extracted characters. Scanned
                      PDFs are not supported; use a text-based PDF or paste the
                      text.
                    </FieldDescription>
                    {sourceError && <FieldError>{sourceError}</FieldError>}
                  </Field>
                </TabsContent>
              </Tabs>
              <details>
                <summary className="cursor-pointer py-2 font-heading text-sm font-semibold">
                  More details (optional outcome and lessons)
                </summary>
                <FieldGroup className="pt-3">
                  <Field>
                    <FieldLabel htmlFor="case-outcome">
                      Recorded outcome
                    </FieldLabel>
                    <Textarea
                      id="case-outcome"
                      maxLength={5000}
                      rows={2}
                      placeholder="Leave blank if the outcome was not recorded."
                      value={fields.outcome}
                      onChange={(e) => update("outcome", e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="case-lessons">
                      Recorded lessons
                    </FieldLabel>
                    <Textarea
                      id="case-lessons"
                      maxLength={5000}
                      rows={2}
                      placeholder="What did the team document learning?"
                      value={fields.lessons}
                      onChange={(e) => update("lessons", e.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </details>
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
          <Separator />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                pending ||
                !fields.title.trim() ||
                (mode === "file" ? !file : !fields.text.trim() || tooLong)
              }
            >
              {pending && (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
              )}
              {pending ? "Adding case…" : "Add case"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
