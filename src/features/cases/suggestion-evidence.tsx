import type { SuggestedValue } from "./case-suggestions";

export const CASE_FIELD_LABELS = {
  title: "Case title",
  context: "Context & architecture",
  outcome: "Recorded outcome",
  lessons: "Recorded lessons & caveats",
};
export function SuggestionEvidence({
  evidence,
  sourceId,
}: {
  evidence: SuggestedValue["evidence"];
  sourceId?: string;
}) {
  if (!evidence.length) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer py-1 font-medium">
        Supporting evidence ({evidence.length})
      </summary>
      <div className="flex flex-col gap-3 pt-2">
        {evidence.map((item) => (
          <blockquote
            key={`${item.page}:${item.quote}`}
            className="border-l-2 border-primary pl-3"
          >
            <p className="wrap-anywhere whitespace-pre-wrap">“{item.quote}”</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sourceId ? (
                <a
                  className="underline underline-offset-4"
                  href={`/api/sources/${sourceId}/original${item.page === null ? "" : `#page=${item.page}`}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.page === null
                    ? "Original source"
                    : `Original PDF · Page ${item.page}`}
                </a>
              ) : item.page === null ? (
                "Source text"
              ) : (
                `PDF · Page ${item.page}`
              )}
            </p>
          </blockquote>
        ))}
      </div>
    </details>
  );
}
