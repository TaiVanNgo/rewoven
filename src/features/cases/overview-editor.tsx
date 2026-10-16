"use client";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  type CaseOverview,
  emptyOverview,
  OVERVIEW_KEYS,
  OVERVIEW_SECTIONS,
} from "./case-overview";
import { SuggestionEvidence } from "./suggestion-evidence";

export function OverviewEditor({
  value,
  onChange,
  disabled = false,
  prefix = "overview",
}: {
  value: CaseOverview | null;
  onChange: (value: CaseOverview) => void;
  disabled?: boolean;
  prefix?: string;
}) {
  const overview = value ?? emptyOverview();
  function edit(key: (typeof OVERVIEW_KEYS)[number], id: string, text: string) {
    onChange({
      ...overview,
      classification: "project",
      sections: {
        ...overview.sections,
        [key]: overview.sections[key].map((f) =>
          f.id === id ? { ...f, text, origin: "user", evidence: [] } : f,
        ),
      },
    });
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Keep each finding short. Editing a finding marks it as your note and
        removes its AI citations. Empty sections stay “Not documented.”
      </p>
      {overview.classification === "non_project" && (
        <output className="rounded-card bg-muted p-4">
          The reading did not identify a project. No project findings were
          generated. You can enter project details yourself if this
          classification is incorrect.
        </output>
      )}
      {OVERVIEW_KEYS.map((key) => (
        <fieldset
          key={key}
          disabled={disabled}
          className="flex min-w-0 flex-col gap-3"
        >
          <legend className="mb-3 font-heading font-semibold">
            {OVERVIEW_SECTIONS[key]}
          </legend>
          {overview.sections[key].map((finding, index) => (
            <Field key={finding.id}>
              <FieldLabel htmlFor={`${prefix}-${key}-${finding.id}`}>
                Finding {index + 1}
                {finding.origin === "user"
                  ? " · Your note"
                  : " · Source-linked"}
              </FieldLabel>
              <Textarea
                id={`${prefix}-${key}-${finding.id}`}
                value={finding.text}
                maxLength={600}
                rows={3}
                onChange={(e) => edit(key, finding.id, e.target.value)}
              />
              <SuggestionEvidence evidence={finding.evidence} />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={() =>
                  onChange({
                    ...overview,
                    sections: {
                      ...overview.sections,
                      [key]: overview.sections[key].filter(
                        (f) => f.id !== finding.id,
                      ),
                    },
                  })
                }
              >
                Remove finding {index + 1}
              </Button>
            </Field>
          ))}
          {overview.sections[key].length < 4 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                onChange({
                  ...overview,
                  classification: "project",
                  sections: {
                    ...overview.sections,
                    [key]: [
                      ...overview.sections[key],
                      {
                        id: crypto.randomUUID(),
                        text: "",
                        origin: "user",
                        evidence: [],
                      },
                    ],
                  },
                })
              }
            >
              Add finding to {OVERVIEW_SECTIONS[key].toLowerCase()}
            </Button>
          )}
        </fieldset>
      ))}
    </div>
  );
}
