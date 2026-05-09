export interface FrontmatterResult {
  data: Record<string, unknown>;
  body: string;
}

export function parseMarkdownFrontmatter(markdown: string): FrontmatterResult | null {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return null;
  }

  const normalized = markdown.replace(/\r\n/g, "\n");
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    return null;
  }

  const raw = normalized.slice(4, end);
  const body = normalized.slice(end + 5);
  const data: Record<string, unknown> = {};

  for (const line of raw.split("\n")) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    data[key] = value.replace(/^["']|["']$/g, "");
  }

  return { data, body };
}
