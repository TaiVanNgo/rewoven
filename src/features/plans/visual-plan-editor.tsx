"use client";

import type { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  BoldIcon,
  CodeIcon,
  CodeXmlIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  Undo2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  planEditorExtensions,
  safePlanLink,
  selectionContainsCitedBlock,
  visualEditorLimitation,
} from "./editor-markdown";

const extensions = [...planEditorExtensions(), Markdown];

function EditorToolbar({
  editor,
  editable,
}: {
  editor: Editor;
  editable: boolean;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState("");
  const selection = useRef({ from: 0, to: 0 });
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      let citation = false;
      e.state.doc.nodesBetween(
        e.state.selection.from,
        e.state.selection.to,
        (node) => {
          if (node.type.name === "planCitation") citation = true;
        },
      );
      return {
        paragraph: e.isActive("paragraph"),
        h1: e.isActive("heading", { level: 1 }),
        h2: e.isActive("heading", { level: 2 }),
        h3: e.isActive("heading", { level: 3 }),
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        strike: e.isActive("strike"),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        quote: e.isActive("blockquote"),
        code: e.isActive("code"),
        codeBlock: e.isActive("codeBlock"),
        link: e.isActive("link"),
        undo: e.can().undo(),
        redo: e.can().redo(),
        empty: e.state.selection.empty,
        citation,
        citedBlock: selectionContainsCitedBlock(e),
      };
    },
  });
  const actions = [
    {
      label: "Paragraph",
      icon: PilcrowIcon,
      active: state.paragraph,
      run: () => editor.chain().focus().setParagraph().run(),
    },
    {
      label: "Heading 1",
      icon: Heading1Icon,
      active: state.h1,
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "Heading 2",
      icon: Heading2Icon,
      active: state.h2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      icon: Heading3Icon,
      active: state.h3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Bold",
      icon: BoldIcon,
      active: state.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: ItalicIcon,
      active: state.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Strikethrough",
      icon: StrikethroughIcon,
      active: state.strike,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Bullet list",
      icon: ListIcon,
      active: state.bullet,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrderedIcon,
      active: state.ordered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Blockquote",
      icon: QuoteIcon,
      active: state.quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Inline code",
      icon: CodeIcon,
      active: state.code,
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: "Code block",
      icon: CodeXmlIcon,
      active: state.codeBlock,
      disabled: state.citedBlock,
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: "Horizontal rule",
      icon: MinusIcon,
      run: () => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      label: "Edit link",
      icon: LinkIcon,
      active: state.link,
      disabled:
        state.codeBlock || state.citation || (state.empty && !state.link),
      run: () => {
        selection.current = {
          from: editor.state.selection.from,
          to: editor.state.selection.to,
        };
        setHref(String(editor.getAttributes("link").href ?? ""));
        setLinkError("");
        setLinkOpen(true);
      },
    },
    {
      label: "Undo",
      icon: Undo2Icon,
      disabled: !state.undo,
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: "Redo",
      icon: Redo2Icon,
      disabled: !state.redo,
      run: () => editor.chain().focus().redo().run(),
    },
  ];
  function applyLink(remove = false) {
    const value = href.trim();
    if (!remove && !safePlanLink(value)) {
      setLinkError(
        "Use an http://, https://, mailto:, or local URL without spaces.",
      );
      return;
    }
    const chain = editor
      .chain()
      .focus()
      .setTextSelection(selection.current)
      .extendMarkRange("link");
    if (remove) chain.unsetLink().run();
    else chain.setLink({ href: value }).run();
    setLinkOpen(false);
  }
  return (
    <>
      <fieldset
        aria-label="Text formatting"
        className="flex min-w-0 flex-wrap gap-1 border-b border-border p-2"
      >
        {actions.map(({ label, icon: Icon, active, disabled, run }) => (
          <Button
            key={label}
            type="button"
            size="icon"
            variant={active ? "secondary" : "ghost"}
            aria-label={label}
            title={label}
            aria-pressed={active}
            disabled={!editable || disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={run}
          >
            <Icon />
          </Button>
        ))}
      </fieldset>
      {state.citedBlock && (
        <p className="px-3 pt-2 text-xs text-muted-foreground">
          Move source markers outside this paragraph before turning it into a
          code block.
        </p>
      )}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit link</DialogTitle>
            <DialogDescription>
              Add a web, email, or local link to the selected text.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
            className="flex flex-col gap-4"
          >
            <FieldGroup>
              <Field data-invalid={!!linkError}>
                <FieldLabel htmlFor="plan-link-url">Link URL</FieldLabel>
                <Input
                  id="plan-link-url"
                  value={href}
                  onChange={(event) => setHref(event.target.value)}
                  aria-invalid={!!linkError}
                />
                {linkError && <FieldError>{linkError}</FieldError>}
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={!state.link || !editable}
                onClick={() => applyLink(true)}
              >
                Remove link
              </Button>
              <Button type="submit" disabled={!editable}>
                Apply link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function VisualPlanEditor({
  markdown,
  editable,
  onChange,
}: {
  markdown: string;
  editable: boolean;
  onChange: (markdown: string) => void;
}) {
  const emitted = useRef(markdown);
  const baseline = useRef({ markdown, json: "" });
  const editorRef = useRef<Editor | null>(null);
  const [pasteNotice, setPasteNotice] = useState("");
  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content: markdown,
    contentType: "markdown",
    editable,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Plan content",
        "aria-multiline": "true",
        class: "plan-prose plan-visual-content wrap-anywhere",
      },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain");
        if (!text || !editorRef.current) return true;
        // Use clipboard text, never foreign HTML, scripts, or embedded resources.
        const limitation = visualEditorLimitation(text);
        if (
          editorRef.current.isActive("codeBlock") ||
          editorRef.current.isActive("code")
        ) {
          view.dispatch(view.state.tr.insertText(text));
        } else if (limitation) {
          editorRef.current.commands.insertContent({
            type: "codeBlock",
            content: [{ type: "text", text }],
          });
          setPasteNotice(
            "Pasted as a code block to preserve literal text. Use Markdown mode to paste tables, HTML, images, or other unsupported formatting as source.",
          );
        } else {
          editorRef.current.commands.insertContent(text, {
            contentType: "markdown",
          });
          setPasteNotice("");
        }
        return true;
      },
    },
    onCreate({ editor }) {
      baseline.current.json = JSON.stringify(editor.getJSON());
    },
    onUpdate({ editor }) {
      const next =
        JSON.stringify(editor.getJSON()) === baseline.current.json
          ? baseline.current.markdown
          : editor.getMarkdown();
      emitted.current = next;
      onChange(next);
    },
  });
  useEffect(() => {
    editorRef.current = editor;
    if (!editor) return;
    editor.setEditable(editable, false);
    if (markdown !== emitted.current) {
      editor.commands.setContent(markdown, {
        contentType: "markdown",
        emitUpdate: false,
      });
      emitted.current = markdown;
      baseline.current = { markdown, json: JSON.stringify(editor.getJSON()) };
    }
  }, [editor, editable, markdown]);
  return (
    <div className="rounded-control border border-border bg-card">
      {editor ? (
        <EditorToolbar editor={editor} editable={editable} />
      ) : (
        <output className="block p-4">Preparing visual editor…</output>
      )}
      <EditorContent editor={editor} />
      {pasteNotice && (
        <output className="block p-3 text-sm text-muted-foreground">
          {pasteNotice}
        </output>
      )}
    </div>
  );
}
