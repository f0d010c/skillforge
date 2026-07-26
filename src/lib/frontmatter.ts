import YAML from "yaml";

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
  try {
    const data = YAML.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }
    return { data: data as Record<string, unknown>, body };
  } catch {
    return null;
  }
}
