import { getDocumentProxy } from "unpdf";
import type { SourceFormat, SourcePage } from "./types";
import { MAX_SOURCE_CHARS } from "./types";
import { InputError, validateText } from "./validation";

export type ExtractedSource = {
  text: string;
  pages: SourcePage[];
  warnings: string[];
};
export async function extractSource(
  bytes: Uint8Array,
  format: SourceFormat,
): Promise<ExtractedSource> {
  if (format !== "pdf") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new InputError(
        "This file is not UTF-8 text. Save it as UTF-8 or paste the content.",
      );
    }
    validateText(text);
    return { text, pages: [{ number: 1, text }], warnings: [] };
  }
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-"))
    throw new InputError(
      "This PDF is corrupt or invalid. Choose a valid text-based PDF or paste the text.",
    );
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes), {
      useSystemFonts: true,
    });
    const pages: SourcePage[] = [];
    const warnings: string[] = [];
    let length = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
        )
        .join("")
        .trim();
      length += text.length + (number > 1 ? 2 : 0);
      if (length > MAX_SOURCE_CHARS)
        throw new InputError(
          "Extracted PDF text exceeds 50,000 characters. Split the PDF into smaller documents; no text has been truncated.",
        );
      pages.push({ number, text });
      if (!text.trim())
        warnings.push(
          `Page ${number} has no extractable text. Images and scanned content on that page are unavailable.`,
        );
      page.cleanup();
    }
    if (!pages.some((page) => page.text.trim()))
      throw new InputError(
        "This PDF has no readable embedded text. Scanned PDFs need OCR, which is not supported. Choose a text-based PDF or paste the text.",
      );
    return {
      text: pages.map((page) => page.text).join("\n\n"),
      pages,
      warnings,
    };
  } catch (error) {
    if (error instanceof InputError) throw error;
    if (
      error instanceof Error &&
      /password|encrypted/i.test(error.name + error.message)
    )
      throw new InputError(
        "This PDF is password-protected. Export an unlocked text-based PDF or paste the text.",
      );
    throw new InputError(
      "This PDF could not be read. It may be corrupt. Choose another text-based PDF or paste the text.",
    );
  } finally {
    await pdf?.loadingTask.destroy();
  }
}
export function chunkPages(pages: SourcePage[], format: SourceFormat) {
  const chunks: {
    ordinal: number;
    page_number: number | null;
    char_start: number;
    char_end: number;
    text: string;
  }[] = [];
  for (const page of pages) {
    for (let start = 0; start < page.text.length; start += 2000) {
      const text = page.text.slice(start, start + 2000);
      if (text.trim())
        chunks.push({
          ordinal: chunks.length,
          page_number: format === "pdf" ? page.number : null,
          char_start: start,
          char_end: start + text.length,
          text,
        });
    }
  }
  return chunks;
}
