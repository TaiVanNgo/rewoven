import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chunkPages, extractSource } from "../src/features/cases/extraction";
import { MAX_FILE_BYTES, MAX_SOURCE_CHARS } from "../src/features/cases/types";
import {
  metadataField,
  validateFile,
  validateText,
} from "../src/features/cases/validation";

const encode = (value: string) => new TextEncoder().encode(value);
test("validates required inputs, formats, and exact boundaries", () => {
  assert.throws(() => validateText("  "));
  assert.throws(() => validateText("a".repeat(MAX_SOURCE_CHARS + 1)));
  validateText("a".repeat(MAX_SOURCE_CHARS));
  assert.equal(validateFile("NOTES.MD", MAX_FILE_BYTES), "md");
  assert.throws(() => validateFile("notes.md", MAX_FILE_BYTES + 1));
  assert.throws(() => validateFile("notes.docx", 10));
  assert.throws(() => validateFile("notes.txt", 0));
  assert.equal(metadataField(" Title ", "Title", 200, true), "Title");
  assert.throws(() => metadataField(" ", "Title", 200, true));
});
test("retains plain source content and rejects non-UTF-8 bytes", async () => {
  const original = "# Notes\n\nQuyền phê duyệt — manager approval.\n";
  const result = await extractSource(encode(original), "md");
  assert.equal(result.text, original);
  await assert.rejects(
    extractSource(new Uint8Array([255, 254]), "txt"),
    /UTF-8/,
  );
});
test("extracts real PDF text with page numbers and identifies empty pages", async () => {
  const result = await extractSource(
    new Uint8Array(await readFile("tests/fixtures/mixed-pages.pdf")),
    "pdf",
  );
  assert.equal(result.pages.length, 3);
  assert.match(result.pages[0].text, /first page/);
  assert.equal(result.pages[1].text, "");
  assert.equal(result.pages[2].number, 3);
  assert.match(result.warnings[0], /Page 2/);
  const chunks = chunkPages(result.pages, "pdf");
  assert.deepEqual(
    chunks.map((c) => c.page_number),
    [1, 3],
  );
});
test("rejects corrupt, textless, and oversized extracted PDFs", async () => {
  await assert.rejects(extractSource(encode("not a PDF"), "pdf"), /corrupt/);
  await assert.rejects(
    extractSource(
      new Uint8Array(await readFile("tests/fixtures/no-text.pdf")),
      "pdf",
    ),
    /Scanned PDFs/,
  );
  await assert.rejects(
    extractSource(
      new Uint8Array(await readFile("tests/fixtures/too-much-text.pdf")),
      "pdf",
    ),
    /50,000/,
  );
});
test("chunks retain offsets and do not cross page boundaries", () => {
  const chunks = chunkPages([{ number: 3, text: "x".repeat(4001) }], "pdf");
  assert.deepEqual(
    chunks.map((c) => [c.char_start, c.char_end]),
    [
      [0, 2000],
      [2000, 4000],
      [4000, 4001],
    ],
  );
  assert.ok(chunks.every((c) => c.page_number === 3));
});

test("chunks preserve a search word across the size boundary and exact offsets", () => {
  const text = `${"a ".repeat(998)}narwhal recovery procedure`;
  const chunks = chunkPages([{ number: 3, text }], "pdf");
  assert.ok(chunks.some((chunk) => chunk.text.includes("narwhal")));
  assert.equal(chunks.map((chunk) => chunk.text).join(""), text);
  for (const chunk of chunks) {
    assert.equal(chunk.text, text.slice(chunk.char_start, chunk.char_end));
    assert.ok(chunk.text.length <= 2000);
    assert.equal(chunk.page_number, 3);
  }
});

test("chunks prefer paragraph boundaries including Windows line endings", () => {
  for (const separator of ["\n\n", "\r\n \r\n"]) {
    const paragraph = `${"intro ".repeat(200)}${separator}`;
    const text = `${paragraph}${"details ".repeat(300)}`;
    const chunks = chunkPages([{ number: 1, text }], "md");
    assert.equal(chunks[0].text, paragraph);
    assert.equal(chunks[1].char_start, paragraph.length);
    assert.equal(chunks.map((chunk) => chunk.text).join(""), text);
  }
});

test("rejects password-protected PDFs with a recovery action", async () => {
  await assert.rejects(
    extractSource(
      new Uint8Array(await readFile("tests/fixtures/encrypted.pdf")),
      "pdf",
    ),
    /password-protected/,
  );
});
