import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  emptyOverview,
  OVERVIEW_KEYS,
  type OverviewSection,
} from "../src/features/cases/case-overview";
import { validateSuggestions } from "../src/features/cases/case-suggestions";
import { extractSource } from "../src/features/cases/extraction";
import type { SourceFormat } from "../src/features/cases/types";

export const LEGACY_TITLES = [
  "Expense Approval Portal",
  "Client Onboarding Checklist",
  "Support Knowledge Base",
  "Purchase Workflow Notes",
  "Inventory Reconciliation",
  "Appointment Scheduling",
  "Vendor Billing Portal",
  "Incident Handoff Log",
  "Customer Import Tool",
  "Release Checklist",
];
export function seedId(value: string, namespace = "rewoven-threadline-v1") {
  const hash = createHash("sha256")
    .update(`${namespace}:${value}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export const legacySampleIds = [
  ...LEGACY_TITLES.map((title) => seedId(title, "rewoven-seed-v1")),
  ...Array.from({ length: 9 }, (_, i) =>
    seedId(String(i + 1).padStart(2, "0"), "rewoven-sample-v2"),
  ),
];
type Fixture = {
  key: string;
  title: string;
  sources: { key: string; file: string; sha256: string }[];
  sections: Record<
    OverviewSection,
    {
      text: string;
      evidence: { source: string; page: number | null; quote: string }[];
    }[]
  >;
};
export async function loadSampleCatalog() {
  const fixtures: Fixture[] = JSON.parse(
    await readFile(
      new URL("../supabase/fixtures/cases.json", import.meta.url),
      "utf8",
    ),
  );
  if (
    fixtures.length !== 9 ||
    new Set(fixtures.map((f) => f.key)).size !== 9 ||
    fixtures.some(
      (f) =>
        f.sources.length !== 3 ||
        new Set(f.sources.map((s) => s.key)).size !== 3,
    )
  )
    throw new Error(
      "The public sample catalog must contain nine unique project cases.",
    );
  return Promise.all(
    fixtures.map(async (fixture) => {
      const id = seedId(fixture.key);
      const sources = await Promise.all(
        fixture.sources.map(async (source) => {
          const bytes = new Uint8Array(
            await readFile(new URL(`../${source.file}`, import.meta.url)),
          );
          if (
            createHash("sha256").update(bytes).digest("hex") !== source.sha256
          )
            throw new Error(
              `Original checksum changed for sample ${fixture.key}/${source.key}. Review the source version first.`,
            );
          const format: SourceFormat = source.file.endsWith(".pdf")
            ? "pdf"
            : "md";
          const extracted = await extractSource(bytes, format);
          if (extracted.warnings.length || !extracted.text.trim())
            throw new Error(
              `Sample ${fixture.key}/${source.key} has incomplete extraction.`,
            );
          const sourceId = seedId(
            `${fixture.key}/${source.key}/${source.sha256}`,
          );
          const filename = source.file.split("/").at(-1) ?? "source";
          return {
            ...source,
            sourceId,
            filename,
            bytes,
            format,
            extracted,
            path: `seeds/${id}/${sourceId}/${filename}`,
          };
        }),
      );
      const overview = emptyOverview();
      overview.provenance = "curated";
      overview.classification = "project";
      overview.sources = sources.map((s) => ({ id: s.sourceId, version: 1 }));
      for (const key of OVERVIEW_KEYS) {
        if (fixture.sections[key].length > 4)
          throw new Error("Sample section exceeds the finding limit.");
        overview.sections[key] = fixture.sections[key].map((finding, index) => {
          if (!finding.text.trim() || finding.text.length > 600)
            throw new Error("Invalid curated finding.");
          // The same exact-quote validator used by AI reading checks every fixture.
          const evidence = finding.evidence.flatMap((reference) => {
            const source = sources.find((s) => s.key === reference.source);
            if (!source)
              throw new Error("Curated finding references an unknown source.");
            const validated = validateSuggestions(
              {
                title: { value: "", evidence: [] },
                context: { value: finding.text, evidence: [reference] },
                outcome: { value: "", evidence: [] },
                lessons: { value: "", evidence: [] },
              },
              source.extracted.pages,
              source.format === "pdf",
            );
            return validated.context.evidence.map((e) => ({
              ...e,
              sourceId: source.sourceId,
              sourceTitle: source.filename,
              sourceVersion: 1,
            }));
          });
          if (!evidence.length)
            throw new Error("A curated finding needs original evidence.");
          return {
            id: `${key}-${index + 1}`,
            text: finding.text,
            origin: "source" as const,
            evidence,
          };
        });
      }
      return {
        fixture,
        id,
        sources,
        overview,
      };
    }),
  );
}
