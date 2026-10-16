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
  let result = await extractSourceStage(bytes, format);
  while (!result.complete)
    result = await extractSourceStage(
      bytes,
      format,
      result.pages,
      result.warnings,
    );
  return {
    text: result.pages.map((p) => p.text).join("\n\n"),
    pages: result.pages,
    warnings: result.warnings,
  };
}
export async function extractSourceStage(
  bytes: Uint8Array,
  format: SourceFormat,
  previous: SourcePage[] = [],
  previousWarnings: string[] = [],
) {
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
    return {
      pages: [{ number: 1, text }],
      warnings: [],
      pageCount: 1,
      complete: true,
    };
  }
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-"))
    throw new InputError(
      "This PDF is corrupt or invalid. Choose a text-based PDF or paste its text.",
    );
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes), {
      useSystemFonts: true,
    });
    const pages = [...previous],
      warnings = [...previousWarnings];
    let length = pages.map((p) => p.text).join("\n\n").length;
    const end = Math.min(pdf.numPages, pages.length + 10);
    for (let number = pages.length + 1; number <= end; number++) {
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
          "Extracted PDF text exceeds 500,000 characters. Split the PDF; no text has been truncated.",
        );
      pages.push({ number, text });
      if (!text.trim())
        warnings.push(
          `Page ${number} has no extractable text. Images and scanned content on that page are unavailable.`,
        );
      page.cleanup();
    }
    const complete = pages.length === pdf.numPages;
    if (complete && !pages.some((p) => p.text.trim()))
      throw new InputError(
        "This PDF has no readable embedded text. Scanned PDFs need OCR, which is not supported.",
      );
    return { pages, warnings, pageCount: pdf.numPages, complete };
  } catch (error) {
    if (error instanceof InputError) throw error;
    if (
      error instanceof Error &&
      /password|encrypted/i.test(error.name + error.message)
    )
      throw new InputError(
        "This PDF is password-protected. Export an unlocked PDF or paste the text.",
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
    for (let start = 0; start < page.text.length;) {
      let end = Math.min(start + 2000, page.text.length);
      if (end < page.text.length) {
        const candidate = page.text.slice(start, end);
        const paragraph = Array.from(
          candidate.matchAll(/\r?\n[\t ]*\r?\n/gu),
        ).at(-1);
        if (paragraph && paragraph.index > 0) {
          end = start + paragraph.index + paragraph[0].length;
        } else if (
          !/\s/u.test(page.text[end - 1]) &&
          !/\s/u.test(page.text[end])
        ) {
          const boundary = candidate.search(/\s+\S*$/u);
          if (boundary > 0) end = start + boundary + 1;
        }
      }
      // PostgreSQL JSON cannot store half a UTF-16 surrogate pair. Keep exact offsets without splitting one.
      if (
        end < page.text.length &&
        /[\uD800-\uDBFF]/u.test(page.text[end - 1]) &&
        /[\uDC00-\uDFFF]/u.test(page.text[end])
      )
        end--;
      // An unbroken token longer than the limit still needs a bounded chunk.
      const text = page.text.slice(start, end);
      if (text.trim())
        chunks.push({
          ordinal: chunks.length,
          page_number: format === "pdf" ? page.number : null,
          char_start: start,
          char_end: end,
          text,
        });
      start = end;
    }
  }
  return chunks;
}
