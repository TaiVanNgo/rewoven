export class SourceLocationError extends Error {}

export type SourceLocation = {
  version: number | null;
  page: number;
  start?: number;
  end?: number;
  quote: string;
};

export function sourceLocation(query: URLSearchParams): SourceLocation {
  function integer(key: string, minimum: number) {
    const raw = query.get(key);
    if (raw === null) return undefined;
    if (
      !/^\d+$/.test(raw) ||
      !Number.isSafeInteger(Number(raw)) ||
      Number(raw) < minimum
    )
      throw new SourceLocationError("Invalid source location.");
    return Number(raw);
  }
  const version = integer("version", 1) ?? null;
  const page = integer("page", 1) ?? 1;
  const start = integer("start", 0);
  const end = integer("end", 0);
  const quote = query.get("quote") ?? "";
  if (
    quote.length > 10000 ||
    (end !== undefined &&
      (start === undefined || end <= start || end - start > 10000))
  )
    throw new SourceLocationError("Invalid source location.");
  return { version, page, start, end, quote };
}

// Keep a mapping back to the original UTF-16 offsets while collapsing whitespace.
function normalizedText(text: string) {
  let value = "";
  const starts: number[] = [],
    ends: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = /\s/u.test(text[i]) ? " " : text[i];
    if (char === " " && value.endsWith(" ")) {
      ends[ends.length - 1] = i + 1;
    } else {
      value += char;
      starts.push(i);
      ends.push(i + 1);
    }
  }
  return { value, starts, ends };
}

export function sourceContext(text: string, location: SourceLocation) {
  if (
    (location.start !== undefined && location.start > text.length) ||
    (location.end !== undefined && location.end > text.length)
  )
    throw new SourceLocationError(
      "This citation's text location is unavailable.",
    );
  let match: { start: number; end: number } | null = null;
  const quote = location.quote.replace(/\s+/gu, " ").trim();
  if (location.start !== undefined && location.end !== undefined) {
    const candidate = text
      .slice(location.start, location.end)
      .replace(/\s+/gu, " ")
      .trim();
    if (!quote || quote === candidate)
      match = { start: location.start, end: location.end };
  } else if (quote) {
    const normalized = normalizedText(text);
    const index = normalized.value.indexOf(quote);
    if (index >= 0)
      match = {
        start: normalized.starts[index],
        end: normalized.ends[index + quote.length - 1],
      };
  }
  const anchor = match?.start ?? location.start ?? 0;
  const start = Math.max(0, anchor - 600);
  const end = Math.min(
    text.length,
    Math.max(start + 3000, (match?.end ?? anchor) + 600),
  );
  return {
    text: text.slice(start, end),
    start,
    highlight: match
      ? { start: match.start - start, end: match.end - start }
      : null,
  };
}
