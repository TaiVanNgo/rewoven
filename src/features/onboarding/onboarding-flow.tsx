"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  MessageSquareIcon,
  PaperclipIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/workspace/brand-logo";
import { ThemeToggle } from "@/components/workspace/theme-toggle";
import { cn } from "@/lib/utils";
import { type OnboardingStarter, onboardingSteps } from "./model";
import { useOnboarding } from "./onboarding-provider";

function focusHeading(node: HTMLHeadingElement | null) {
  node?.focus();
}

export function OnboardingFlow({ steps }: { steps: ReactNode[] }) {
  const { replayKey } = useOnboarding();
  return <OnboardingSteps key={replayKey} steps={steps} />;
}

function OnboardingSteps({ steps }: { steps: ReactNode[] }) {
  const [step, setStep] = useState(0);
  const { dismiss, returnTo } = useOnboarding();
  const router = useRouter();
  const final = step === onboardingSteps.length - 1;

  function finish(starter?: OnboardingStarter) {
    dismiss();
    router.replace(starter ? `/?starter=${starter}` : returnTo);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 md:p-8">
      <a
        href="#onboarding-heading"
        className="sr-only rounded-control bg-primary p-3 text-primary-foreground focus:not-sr-only"
      >
        Skip to this step
      </a>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div>
            <p className="font-heading text-lg font-bold">Rewoven</p>
            <p className="text-xs text-muted-foreground">
              Your team’s experience, connected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex">
            No sign-in required
          </Badge>
          <ThemeToggle />
          <Button variant="outline" onClick={() => finish()}>
            Skip
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Button>
        </div>
      </header>

      <div className="grid flex-1 overflow-hidden rounded-workspace border border-border bg-card shadow-panel lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          aria-label="Your introduction to Rewoven"
          className="flex flex-col gap-6 bg-secondary p-6 text-secondary-foreground md:p-8"
        >
          <div>
            <p className="mb-3 text-sm font-semibold">
              A new project. Familiar challenges.
            </p>
            <p className="max-w-xs font-heading text-2xl leading-tight font-bold tracking-tight md:text-3xl">
              Your team has been here before.
            </p>
          </div>
          <nav aria-label="Onboarding steps">
            <ol className="flex justify-between gap-2 lg:flex-col lg:gap-1">
              {onboardingSteps.map((title, index) => (
                <li key={title}>
                  <button
                    type="button"
                    aria-label={`Step ${index + 1}: ${title}`}
                    aria-current={step === index ? "step" : undefined}
                    onClick={() => setStep(index)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-control p-1 text-left text-sm lg:w-full lg:p-2",
                      step === index && "bg-card text-card-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold",
                        step === index &&
                          "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {index < step ? (
                        <CheckIcon aria-hidden="true" className="size-4" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="hidden lg:inline">{title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div className="mt-auto hidden flex-col items-center gap-2 lg:flex">
            <Image
              src="/images/wren.png"
              width={240}
              height={240}
              sizes="144px"
              alt="Wren, the team archivist, holding a stack of case folders"
              className="h-auto w-full max-w-36 rounded-panel"
            />
            <p className="text-sm font-semibold">
              Meet Wren, your case advisor
            </p>
            <p className="text-center text-xs leading-relaxed">
              Find the lesson. Check the source.
              <br />
              Decide what changes this time.
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-7 p-6 md:p-10 lg:min-h-[680px]">
          <header className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Step {step + 1} of {onboardingSteps.length}
            </p>
            <h1
              id="onboarding-heading"
              key={step}
              ref={focusHeading}
              tabIndex={-1}
              className="max-w-2xl font-heading text-2xl leading-tight font-bold tracking-tight outline-none md:text-4xl"
            >
              {onboardingSteps[step]}
            </h1>
          </header>
          <div className="flex flex-1 flex-col gap-6 text-base leading-relaxed [&_p]:max-w-prose">
            {steps[step]}
            {final && (
              <div className="flex flex-col gap-3">
                <p className="font-heading font-semibold">
                  Where would you like to start?
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => finish("history")}>
                    <MessageSquareIcon
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    Ask about past projects
                  </Button>
                  <Button variant="outline" onClick={() => finish("request")}>
                    <PaperclipIcon
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    Bring a new request
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  We’ll open an editable prompt. Nothing is sent until you
                  choose Send.
                </p>
              </div>
            )}
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-border pt-5">
            <Button
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((value) => value - 1)}
            >
              <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" />
              Back
            </Button>
            {final ? (
              <Button variant="ghost" onClick={() => finish()}>
                Return to workspace
              </Button>
            ) : (
              <Button onClick={() => setStep((value) => value + 1)}>
                Next
                <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
              </Button>
            )}
          </footer>
        </main>
      </div>
      <footer className="text-center text-xs leading-relaxed text-muted-foreground">
        Threadline Delivery, Northbank Services, and all nine projects are
        fictional demo material.
      </footer>
    </div>
  );
}
