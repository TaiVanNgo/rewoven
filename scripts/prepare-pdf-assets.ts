import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = dirname(require.resolve("pdfjs-dist/package.json"));
const { version } = await Bun.file(join(root, "package.json")).json();
const target = join(import.meta.dir, "../public/pdfjs", version);
await mkdir(target, { recursive: true });
await Promise.all([
  cp(
    join(root, "build/pdf.worker.min.mjs"),
    join(target, "pdf.worker.min.mjs"),
  ),
  ...["cmaps", "standard_fonts", "wasm", "iccs"].map((folder) =>
    cp(join(root, folder), join(target, folder), { recursive: true }),
  ),
]);
