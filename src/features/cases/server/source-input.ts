import "server-only";
import { createHash } from "node:crypto";
import type { SourceFormat } from "../types";
import { InputError, validateFile, validateText } from "../validation";

export async function sourceInput(form: FormData) {
  const mode = form.get("mode");
  let format: SourceFormat = "text";
  let title = "Pasted source.txt";
  let originalText: string | null = null;
  let bytes: Uint8Array;
  if (mode === "text") {
    const text = form.get("text");
    if (typeof text !== "string")
      throw new InputError("Paste the original source text.");
    if (form.getAll("file").length)
      throw new InputError("Choose one source per submission.");
    validateText(text);
    originalText = text;
    bytes = new TextEncoder().encode(text);
  } else if (mode === "file") {
    const files = form.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File))
      throw new InputError("Choose one source file.");
    const file = files[0];
    format = validateFile(file.name, file.size);
    title = file.name.slice(0, 200);
    bytes = new Uint8Array(await file.arrayBuffer());
  } else throw new InputError("Choose pasted text or a source file.");
  const hash = createHash("sha256")
    .update(format)
    .update("\0")
    .update(bytes)
    .digest("hex");
  return { format, title, originalText, bytes, hash };
}
