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

// Support only inline emphasis; React keeps all other model output as text.
export function AnswerText({ text }: { text: string }) {
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
          </li>
        ))}
      </List>
    );
  }
  return (
    <p className="query-answer-text whitespace-pre-wrap">
      <InlineText text={text} />
    </p>
  );
}
