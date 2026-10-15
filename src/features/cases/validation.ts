import { MAX_FILE_BYTES, MAX_SOURCE_CHARS, type SourceFormat } from "./types";
export class InputError extends Error {}
export function validateText(text: string) {
  if (!text.trim())
    throw new InputError("Add source text that contains readable content.");
  if (text.length > MAX_SOURCE_CHARS)
    throw new InputError(
      "Source text exceeds 50,000 characters. Split it into smaller documents; no text has been truncated.",
    );
}
export function validateFile(
  name: string,
  size: number,
): Exclude<SourceFormat, "text"> {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension !== "txt" && extension !== "md" && extension !== "pdf")
    throw new InputError("Choose a .txt, .md, or text-based .pdf file.");
  if (!size)
    throw new InputError("This file is empty. Choose a file containing text.");
  if (size > MAX_FILE_BYTES)
    throw new InputError("This file exceeds 5 MB. Choose a smaller file.");
  return extension;
}
export function metadataField(
  value: FormDataEntryValue | null,
  label: string,
  limit: number,
  required = false,
) {
  if (value !== null && typeof value !== "string")
    throw new InputError(`${label} must be text.`);
  const text = (value ?? "").trim();
  if (required && !text) throw new InputError(`${label} is required.`);
  if (text.length > limit)
    throw new InputError(
      `${label} must be ${limit.toLocaleString()} characters or fewer.`,
    );
  return text;
}
