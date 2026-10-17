"use client";

import { FileUpIcon, XIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { CitationMarker } from "@/features/citations/citation-marker";
import { requestCitation } from "@/features/citations/types";
import type { PendingQueryUpload } from "./client";
import type { QueryFile } from "./types";

export function UploadFilesButton({
  disabled,
  onFiles,
}: {
  disabled: boolean;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept=".txt,.md,.pdf"
        aria-label="Upload problem documents"
        className="hidden"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <FileUpIcon aria-hidden="true" />
        Upload files
      </Button>
    </>
  );
}
export function PendingFiles({
  files,
  disabled,
  onRemove,
}: {
  files: PendingQueryUpload[];
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  return files.length ? (
    <ul
      className="mb-3 flex flex-wrap gap-2"
      aria-label="Files for this message"
    >
      {files.map((item) => (
        <li
          key={item.id}
          className="flex max-w-full items-center gap-2 rounded-control border border-border bg-secondary px-3 py-2 text-xs"
        >
          <div className="min-w-0">
            <p className="font-semibold wrap-anywhere">{item.file.name}</p>
            <output>{item.error ?? item.state}</output>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={disabled}
            aria-label={`Remove ${item.file.name}`}
            onClick={() => onRemove(item.id)}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  ) : null;
}
export function FileContext({
  files,
  disabled,
  onToggle,
  onRetry,
}: {
  files: QueryFile[];
  disabled: boolean;
  onToggle: (file: QueryFile) => void;
  onRetry: (file: QueryFile) => void;
}) {
  if (!files.length) return null;
  return (
    <details
      className="mb-3 rounded-control border border-border px-3 py-2 text-xs"
      open={files.some(
        (f) => f.enabled && (f.status !== "ready" || f.warnings.length > 0),
      )}
    >
      <summary className="cursor-pointer font-semibold">
        Problem documents · {files.filter((f) => f.enabled).length} active
      </summary>
      <ul className="mt-2 max-h-48 space-y-3 overflow-y-auto">
        {files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold wrap-anywhere">
                {file.title}
                {!file.enabled && " · Excluded"}
              </p>
              <p>
                {file.status === "reading"
                  ? `Reading ${file.cursor}/${file.total} passages`
                  : file.status}
              </p>
              {file.error_message && (
                <p className="text-destructive">{file.error_message}</p>
              )}
              {file.warnings.map((warning) => (
                <p key={warning} className="text-caution-foreground">
                  {warning}
                </p>
              ))}
            </div>
            {file.status !== "uploading" && (
              <CitationMarker
                reference={requestCitation({
                  id: file.id,
                  documentId: file.id,
                  conversationId: file.conversation_id,
                  title: file.title,
                  version: file.version,
                  page: file.format === "pdf" ? 1 : null,
                  start: 0,
                  end: 0,
                  text: "",
                })}
                number={files.indexOf(file) + 1}
              />
            )}
            {file.enabled &&
              ["extracting", "reading", "failed"].includes(file.status) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onRetry(file)}
                >
                  Retry reading
                </Button>
              )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onToggle(file)}
            >
              {file.enabled ? "Exclude" : "Restore"}
            </Button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted-foreground">
        Request documents describe current work. They are separate from past
        cases. Exclusion affects future replies.
      </p>
    </details>
  );
}
export function MessageFiles({
  files,
  ids,
}: {
  files: QueryFile[];
  ids: string[];
}) {
  if (!ids.length) return null;
  return (
    <ul
      className="mt-2 space-y-1 text-xs"
      aria-label="Uploaded request documents"
    >
      {ids.map((id) => {
        const file = files.find((f) => f.id === id);
        return file ? (
          <li key={id} className="flex items-center gap-2">
            <span className="wrap-anywhere">
              Request document: {file.title}
            </span>
            <CitationMarker
              reference={requestCitation({
                id,
                documentId: id,
                conversationId: file.conversation_id,
                title: file.title,
                version: file.version,
                page: file.format === "pdf" ? 1 : null,
                start: 0,
                end: 0,
                text: "",
              })}
              number={ids.indexOf(id) + 1}
            />
          </li>
        ) : null;
      })}
    </ul>
  );
}
