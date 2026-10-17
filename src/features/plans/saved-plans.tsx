"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { caseApi } from "@/features/cases/api-client";
import type { PlanSummary } from "./types";

export function SavedPlans() {
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      await caseApi("/api/demo-session", {
        method: "POST",
        signal: controller.signal,
      });
      const result = await caseApi<{ plans: PlanSummary[] }>("/api/plans", {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setPlans(result.plans);
    }
    load().catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, []);
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  if (!plans) return <output>Opening your saved plans…</output>;
  if (!plans.length)
    return (
      <div className="rounded-workspace border border-dashed border-border bg-secondary/40 p-10">
        <h2 className="font-heading text-2xl font-bold">
          Your next plan starts with a conversation
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Discuss a request with Wren, choose Draft reuse plan, and save your
          reviewed draft. Saved plans are available during this 24-hour demo
          session.
        </p>
        <Link className="mt-5 inline-block font-semibold underline" href="/">
          Start a chat
        </Link>
      </div>
    );
  return (
    <ul className="flex flex-col divide-y divide-border rounded-workspace border border-border bg-card">
      {plans.map((plan) => (
        <li
          key={plan.id}
          className="flex flex-wrap items-center justify-between gap-4 p-5"
        >
          <div className="min-w-0">
            <Link
              className="font-heading text-lg font-bold wrap-anywhere hover:underline"
              href={`/saved-plans/${plan.id}`}
            >
              {plan.title}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.kind === "clarification"
                ? "Clarification draft"
                : "Reuse plan"}{" "}
              · Saved{" "}
              {new Date(plan.saved_at ?? plan.created_at).toLocaleString()}
            </p>
          </div>
          <Link
            className="text-sm underline"
            href={`/?query=${plan.conversation_id}`}
          >
            Open originating chat
          </Link>
        </li>
      ))}
    </ul>
  );
}
