"use client";

import { ArrowUpRightIcon, InfoIcon, SearchIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useRequestDraft } from "@/features/requests/request-draft";
import { requestSamples } from "@/features/requests/request-samples";

const MotionButton = motion.create(Button);
const constraints = [
  { name: "deadline", label: "Deadline", placeholder: "e.g. 6 weeks" },
  {
    name: "technology",
    label: "Technology",
    placeholder: "e.g. React, Node.js",
  },
  {
    name: "capabilities",
    label: "Required capabilities",
    placeholder: "e.g. Two approval stages",
  },
] as const;

export function RequestComposer({ companion }: { companion: ReactNode }) {
  const { draft, updateDraft } = useRequestDraft();
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reducedMotion = useReducedMotion();
  const canSubmit = draft.request.trim().length > 0;

  function loadSample(sample: (typeof requestSamples)[number]) {
    updateDraft({ request: `[${sample.title}]\n${sample.description}` });
    setSubmitted(false);
    textareaRef.current?.focus({ preventScroll: true });
    textareaRef.current?.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  return (
    <div className="flex flex-col gap-9">
      <div className="grid grid-cols-1 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_310px]">
        <Card variant="soft" className="min-w-0">
          <form
            className="flex flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) setSubmitted(true);
            }}
          >
            <CardHeader className="mb-3">
              <CardTitle>Describe the request</CardTitle>
              <CardAction>
                <Badge variant="label">Primary</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-0">
                <Field className="gap-3">
                  <FieldLabel htmlFor="request" className="sr-only">
                    Describe the request
                  </FieldLabel>
                  <Textarea
                    id="request"
                    name="request"
                    rows={5}
                    maxLength={10000}
                    ref={textareaRef}
                    value={draft.request}
                    onChange={(event) => {
                      updateDraft({
                        request: event.target.value.slice(0, 10000),
                      });
                      setSubmitted(false);
                    }}
                    placeholder="What needs to be built, who is it for, and what should it do?"
                    aria-describedby="request-hint request-counter"
                  />
                  <div className="flex items-start justify-between gap-4">
                    <FieldDescription
                      id="request-hint"
                      className="flex max-w-[340px] items-start gap-1.5"
                    >
                      <InfoIcon
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0"
                      />
                      Plain language is fine. Mention architectural constraints
                      or target teams.
                    </FieldDescription>
                    <span
                      id="request-counter"
                      className="shrink-0 font-mono text-[11px] text-muted-foreground"
                    >
                      {draft.request.length.toLocaleString("en-US")} / 10,000
                    </span>
                  </div>
                </Field>
                <Separator className="mt-5 mb-4" />
                <FieldSet>
                  <FieldLegend>Optional constraints</FieldLegend>
                  <FieldGroup className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {constraints.map(({ name, label, placeholder }) => (
                      <Field key={name} className="gap-1.5">
                        <FieldLabel htmlFor={name}>{label}</FieldLabel>
                        <Input
                          id={name}
                          name={name}
                          value={draft[name]}
                          onChange={(event) =>
                            updateDraft({ [name]: event.target.value })
                          }
                          placeholder={placeholder}
                        />
                      </Field>
                    ))}
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex-wrap gap-4">
              <MotionButton
                type="submit"
                disabled={!canSubmit}
                initial={false}
                whileTap={
                  reducedMotion || !canSubmit ? undefined : { scale: 0.98 }
                }
              >
                <SearchIcon data-icon="inline-start" aria-hidden="true" />
                Find past cases
              </MotionButton>
              <output className="max-w-[300px] text-xs leading-relaxed text-muted-foreground">
                {submitted
                  ? "This is a UI preview. Case retrieval is not connected yet."
                  : "Enter a request or choose a sample below."}
              </output>
            </CardFooter>
          </form>
        </Card>
        {companion}
      </div>
      <section
        aria-labelledby="samples-title"
        className="flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="samples-title" className="font-heading text-sm font-bold">
            Try a sample request
          </h2>
          <span className="text-xs text-muted-foreground">
            Click any to load
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {requestSamples.map((sample) => (
            <MotionButton
              key={sample.title}
              type="button"
              variant="sample"
              size="sample"
              onClick={() => loadSample(sample)}
              aria-pressed={
                draft.request === `[${sample.title}]\n${sample.description}`
              }
              initial={false}
              whileTap={reducedMotion ? undefined : { scale: 0.99 }}
            >
              <span>
                <span className="block leading-snug font-bold">
                  {sample.title}
                </span>
                <span className="mt-1 block font-sans text-[13px] leading-snug font-normal text-muted-foreground">
                  {sample.summary}
                </span>
              </span>
              <span className="flex items-center justify-between gap-2">
                <Badge variant={sample.badgeVariant}>{sample.category}</Badge>
                <span className="flex size-6 items-center justify-center rounded-full bg-card text-card-foreground transition-colors duration-180 ease-interface group-hover:bg-primary group-hover:text-primary-foreground">
                  <ArrowUpRightIcon aria-hidden="true" />
                </span>
              </span>
            </MotionButton>
          ))}
        </div>
      </section>
    </div>
  );
}
