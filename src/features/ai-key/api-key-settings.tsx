"use client";

import { KeyRoundIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hasPersonalKey, setPersonalKey, subscribeKey } from "./client";
import { validPersonalKey } from "./validation";

export function ApiKeySettings({ collapsed }: { collapsed: boolean }) {
  const active = useSyncExternalStore(
    subscribeKey,
    hasPersonalKey,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  function changeOpen(value: boolean) {
    setOpen(value);
    setDraft("");
    setError("");
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        render={
          <Button
            variant="navigation"
            size="navigation"
            className={cn(
              "w-full",
              collapsed && "lg:justify-center lg:gap-0 lg:px-0",
            )}
          />
        }
        title={active ? "Using your OpenAI key" : "API key settings"}
      >
        <KeyRoundIcon aria-hidden="true" />
        <span className={collapsed ? "lg:sr-only" : undefined}>
          {active ? "Your API key is active" : "Use your own API key"}
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>OpenAI API key</DialogTitle>
          <DialogDescription>
            Use your own OpenAI credits for Wren, document reading, reuse plans,
            and semantic search.
          </DialogDescription>
        </DialogHeader>
        <output className="rounded-control border border-border bg-muted/40 p-3 text-sm">
          {active
            ? "Your key is active for new AI requests in this tab."
            : "Using Rewoven’s shared demo key, which has limited credit."}
        </output>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const key = draft.trim();
            if (!validPersonalKey(key)) {
              setError("Enter an OpenAI secret API key starting with sk-.");
              return;
            }
            setPersonalKey(key);
            changeOpen(false);
          }}
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="personal-openai-key"
              className="text-sm font-semibold"
            >
              {active ? "Replace your key" : "Your API key"}
            </label>
            <Input
              id="personal-openai-key"
              type="password"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={512}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
              }}
              placeholder="sk-…"
              aria-invalid={!!error}
              aria-describedby={error ? "key-error key-privacy" : "key-privacy"}
            />
            {error && (
              <p
                id="key-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </div>
          <p id="key-privacy" className="text-sm text-muted-foreground">
            Your key is held in this tab’s memory and sent through Rewoven’s
            server to OpenAI for AI requests. It is never saved to chats or
            browser storage. Reloading or closing this page clears it.
          </p>
          <p className="text-sm text-muted-foreground">
            OpenAI bills your account. A paid ChatGPT subscription does not
            provide API credit. Access is checked on your next AI request;
            Rewoven’s usage limits still apply. A failed personal key never
            switches to the shared key.
          </p>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-sm font-semibold underline underline-offset-4"
          >
            Create an OpenAI API key
          </a>
          <div className="flex flex-wrap justify-end gap-2">
            {active && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPersonalKey("");
                  changeOpen(false);
                }}
              >
                Remove my key
              </Button>
            )}
            <Button type="submit">
              {active ? "Replace key" : "Use my key"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
