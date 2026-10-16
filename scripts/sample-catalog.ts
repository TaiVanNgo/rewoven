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
export function seedId(value: string, namespace = "rewoven-sample-v2") {
  const hash = createHash("sha256")
    .update(`${namespace}:${value}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export const legacySampleIds = LEGACY_TITLES.map((title) =>
  seedId(title, "rewoven-seed-v1"),
);
type Fixture = {
  key: string;
  title: string;
  file: string;
  sha256: string;
  sections: Record<
    OverviewSection,
    { text: string; evidence: { page: number | null; quote: string }[] }[]
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
    fixtures.some((f) => f.key === "10")
  )
    throw new Error(
      "The public sample catalog must contain nine unique project cases.",
    );
  return Promise.all(
    fixtures.map(async (fixture) => {
      const bytes = new Uint8Array(
        await readFile(new URL(`../${fixture.file}`, import.meta.url)),
      );
      if (createHash("sha256").update(bytes).digest("hex") !== fixture.sha256)
        throw new Error(
          `Original checksum changed for sample ${fixture.key}. Review the source version first.`,
        );
      const format = fixture.file.endsWith(".pdf") ? "pdf" : "md";
      const extracted = await extractSource(bytes, format);
      const id = seedId(fixture.key),
        sourceId = seedId(`${fixture.key}/${fixture.sha256}`);
      const filename = fixture.file.split("/").at(-1) ?? "source";
      const overview = emptyOverview();
      overview.provenance = "curated";
      overview.classification = "project";
      overview.sources = [{ id: sourceId, version: 1 }];
      for (const key of OVERVIEW_KEYS) {
        if (fixture.sections[key].length > 4)
          throw new Error("Sample section exceeds the finding limit.");
        overview.sections[key] = fixture.sections[key].map((finding, index) => {
          if (!finding.text.trim() || finding.text.length > 600)
            throw new Error("Invalid curated finding.");
          // The same exact-quote validator used by AI reading checks every fixture.
          const validated = validateSuggestions(
            {
              title: { value: "", evidence: [] },
              context: { value: finding.text, evidence: finding.evidence },
              outcome: { value: "", evidence: [] },
              lessons: { value: "", evidence: [] },
            },
            extracted.pages,
            format === "pdf",
          );
          return {
            id: `${key}-${index + 1}`,
            text: finding.text,
            origin: "source" as const,
            evidence: validated.context.evidence.map((e) => ({
              ...e,
              sourceId,
              sourceTitle: filename,
              sourceVersion: 1,
            })),
          };
        });
      }
      return {
        fixture,
        id,
        sourceId,
        filename,
        bytes,
        format: format as SourceFormat,
        extracted,
        overview,
        path: `seeds/${id}/${sourceId}/${filename}`,
      };
    }),
  );
}
