"use client";
import { FilePenLineIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { caseApi } from "@/features/cases/api-client";
import type { PlanSummary, ReusePlan } from "./types";

export function ChatPlans({
  conversationId,
  contextRevision,
  disabled,
}: {
  conversationId: string;
  contextRevision: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    caseApi<{ plans: PlanSummary[] }>(
      `/api/plans?conversationId=${conversationId}`,
      { signal: controller.signal },
    )
      .then((result) => setPlans(result.plans))
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [conversationId]);
  async function create() {
    setBusy(true);
    setError("");
    key.current ??= crypto.randomUUID();
    setPendingId(key.current);
    try {
      const { plan } = await caseApi<{ plan: ReusePlan }>(
        `/api/queries/${conversationId}/plans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestKey: key.current, contextRevision }),
        },
      );
      if (!active.current) return;
      key.current = null;
      router.push(`/saved-plans/${plan.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Reuse plans for this chat"
      className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-secondary/40 p-3"
    >
      <Button
        variant="outline"
        disabled={disabled || busy}
        onClick={() => void create()}
      >
        <FilePenLineIcon aria-hidden="true" />
        {busy ? "Preparing your request…" : "Draft reuse plan"}
      </Button>
      {pendingId && (
        <Link className="text-sm underline" href={`/saved-plans/${pendingId}`}>
          Open preparation draft
        </Link>
      )}
      {plans.map((plan) => (
        <Link
          key={plan.id}
          className="max-w-60 truncate text-sm underline"
          href={`/saved-plans/${plan.id}`}
        >
          {plan.title} ({plan.saved_at ? "saved" : "draft"})
        </Link>
      ))}
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
