import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

export const moduleRoot = path.dirname(fileURLToPath(import.meta.url));

export function resolveTemplateRoot(): string {
  let current = moduleRoot;
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, "templates");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    current = path.dirname(current);
  }
  return path.resolve(process.cwd(), "templates");
}

export function hyphenName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}
