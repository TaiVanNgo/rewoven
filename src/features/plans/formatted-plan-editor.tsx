"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { visualEditorLimitation } from "./editor-markdown";
import { VisualPlanEditor } from "./visual-plan-editor";

export function FormattedPlanEditor({
  markdown,
  editable,
  onChange,
}: {
  markdown: string;
  editable: boolean;
  onChange: (markdown: string) => void;
}) {
  const limitation = useMemo(
    () => visualEditorLimitation(markdown),
    [markdown],
  );
  const [mode, setMode] = useState(() => (limitation ? "markdown" : "visual"));
  const currentMode = limitation ? "markdown" : mode;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Tabs
        value={currentMode}
        onValueChange={(value) => setMode(String(value))}
      >
        <TabsList aria-label="Editor mode">
          <TabsTrigger value="visual" disabled={!editable || !!limitation}>
            Visual
          </TabsTrigger>
          <TabsTrigger value="markdown" disabled={!editable}>
            Markdown
          </TabsTrigger>
        </TabsList>
        <TabsContent value="visual">
          {currentMode === "visual" && (
            <VisualPlanEditor
              markdown={markdown}
              editable={editable}
              onChange={onChange}
            />
          )}
        </TabsContent>
        <TabsContent value="markdown">
          {limitation && (
            <Alert className="mb-3">
              <AlertDescription>{limitation}</AlertDescription>
            </Alert>
          )}
          <label htmlFor="plan-markdown" className="sr-only">
            Edit Markdown
          </label>
          <Textarea
            id="plan-markdown"
            className="min-h-[560px] resize-y bg-card font-mono text-sm leading-relaxed"
            maxLength={50000}
            disabled={!editable}
            value={markdown}
            onChange={(event) => {
              setMode("markdown");
              onChange(event.target.value);
            }}
          />
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        {markdown.length.toLocaleString()} / 50,000 Markdown characters. Save to
        keep your changes.
      </p>
    </div>
  );
}
