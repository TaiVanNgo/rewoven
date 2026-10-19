// Model output is untrusted. Only static diagrams with application-owned
// configuration are supported; source cannot opt into HTML or interactions.
export function staticDiagramSource(source: string): string {
  // Discard complete presentation-only lines rather than executing model CSS.
  // Inline directives, interaction and configuration still fail the policy.
  return source
    .split("\n")
    .filter((line) => !/^\s*(?:style|classDef|class|linkStyle)\s/.test(line))
    .join("\n");
}
export function diagramAllowed(source: string): boolean {
  return (
    source.length <= 2000 &&
    /^(?:flowchart\s+(?:LR|RL|TB|TD|BT)|graph\s+(?:LR|RL|TB|TD|BT)|sequenceDiagram|stateDiagram-v2|erDiagram)\b/.test(
      source.trim(),
    ) &&
    !/(?:%%\{|^\s*---|\b(?:click|classDef|linkStyle|style)\s|\burl\s*\(|\b(?:href|src)\s*=|<|>|\b(?:https?|javascript|data):)/im.test(
      // Arrows are diagram syntax, not HTML.
      source.replace(/[-=.]+[<>|x)o]+|[<|]+[-=.]+/g, ""),
    )
  );
}
