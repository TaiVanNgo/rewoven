import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type CaseAIReview, SUGGESTION_FIELDS } from "./case-suggestions";
import { CASE_FIELD_LABELS, SuggestionEvidence } from "./suggestion-evidence";

export function AIReadingRecord({ review }: { review: CaseAIReview }) {
  return (
    <Card variant="soft">
      <CardHeader>
        <CardTitle>AI reading record</CardTitle>
        <CardDescription>
          Original AI suggestions, kept separately from your final case details.
          Quotes match the source; review whether they support each suggestion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <details>
          <summary className="cursor-pointer py-1 font-semibold">
            View original AI suggestions
          </summary>
          <div className="flex flex-col gap-5 pt-4">
            <Badge variant="outline">AI draft · Reviewed before saving</Badge>
            {SUGGESTION_FIELDS.map((field) => (
              <section
                key={field}
                className="flex min-w-0 flex-col gap-2"
                aria-label={`Original AI ${CASE_FIELD_LABELS[field].toLowerCase()}`}
              >
                <h3 className="font-semibold">{CASE_FIELD_LABELS[field]}</h3>
                <p className="wrap-anywhere whitespace-pre-wrap">
                  {review.suggestions[field].value ||
                    "Not established by this reading."}
                </p>
                <SuggestionEvidence
                  evidence={review.suggestions[field].evidence}
                  sourceId={review.sourceId}
                />
              </section>
            ))}
            {review.warnings.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {review.warnings.join(" ")}
              </p>
            )}
            <p className="text-xs wrap-anywhere text-muted-foreground">
              Model: {review.model} · Reader version {review.promptVersion}
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
