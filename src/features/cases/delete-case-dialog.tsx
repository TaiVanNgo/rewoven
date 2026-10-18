"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { caseApi } from "./api-client";
import { useCaseWorkspace } from "./case-workspace";
import type { CaseDetail } from "./types";

export function DeleteCaseDialog({
  record,
  returnTo,
}: {
  record: CaseDetail;
  returnTo: string;
}) {
  const router = useRouter();
  const { refresh } = useCaseWorkspace();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          setError("");
        }
      }}
    >
      <DialogTrigger render={<Button variant="destructive" />}>
        Delete case
      </DialogTrigger>
      <DialogContent showCloseButton={!pending} initialFocus={cancel}>
        <DialogHeader>
          <DialogTitle>Delete case permanently?</DialogTitle>
          <DialogDescription>
            Delete “{record.title}” and all its source documents and search
            embeddings. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Saved chats and plans keep their historical excerpts, with a warning
          that the original sources are unavailable. Original files are removed
          separately; interrupted cleanup is retried.
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            ref={cancel}
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                const result = await caseApi<{
                  deleted: true;
                  cleanupPending: boolean;
                }>(`/api/cases/${record.id}`, { method: "DELETE" });
                refresh();
                const target = new URL(returnTo, window.location.origin);
                target.searchParams.set(
                  "deleted",
                  result.cleanupPending ? "cleanup-pending" : "complete",
                );
                router.replace(`${target.pathname}${target.search}`);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Deletion failed. Try again.",
                );
                setPending(false);
              }
            }}
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
