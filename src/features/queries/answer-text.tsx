import type { ReactNode } from "react";
import Markdown from "react-markdown";
import { TechnicalCode } from "./technical-code";

function InlineText({ text }: { text: string }) {
  return text
    .split(/(\*\*[^*\n]+\*\*)/g)
    .map((part, index) =>
      index % 2 === 1 ? (
        <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

// Existing prose keeps its original rendering. Technical replies use a restricted
// Markdown subset; citations are always supplied separately by the application.
export function AnswerText({
  text,
  citations,
}: {
  text: string;
  citations?: ReactNode;
}) {
  if (text.includes("`"))
    return (
      <div className="query-answer-text query-technical-text">
        <Markdown
          skipHtml
          allowedElements={[
            "p",
            "strong",
            "em",
            "ul",
            "ol",
            "li",
            "code",
            "pre",
            "br",
          ]}
          unwrapDisallowed
          components={{
            pre: ({ children }) => <>{children}</>,
            code: ({ className, children }) => {
              const code = String(children).replace(/\n$/, "");
              const language = className?.replace(/^language-/, "") ?? "";
              return language || String(children).endsWith("\n") ? (
                <TechnicalCode code={code} language={language} />
              ) : (
                <code>{children}</code>
              );
            },
          }}
        >
          {text}
        </Markdown>
        {citations && (
          <div className="query-technical-citations">{citations}</div>
        )}
      </div>
    );
  const lines = text.split("\n").filter((line) => line.trim());
  if (
    lines.length > 0 &&
    lines.every((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line))
  ) {
    const List = lines.every((line) => /^\s*\d+[.)]\s+/.test(line))
      ? "ol"
      : "ul";
    return (
      <List className="query-answer-text query-answer-list">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`}>
            <InlineText text={line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")} />
            {index === lines.length - 1 && citations && <> {citations}</>}
          </li>
        ))}
      </List>
    );
  }
  return (
    <p className="query-answer-text whitespace-pre-wrap">
      <InlineText text={text} />
      {citations && <> {citations}</>}
    </p>
  );
}
