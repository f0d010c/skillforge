import path from "node:path";

export const defaultIgnoredDirs = new Set(["node_modules", "dist", ".git", ".next", "coverage", "tmp-e2e"]);

export function isIgnoredPath(root: string, target: string, patterns: string[] = []): boolean {
  const relative = toPosix(path.relative(root, target));
  if (!relative || relative.startsWith("..")) return false;
  return patterns.some((pattern) => matchesPattern(relative, pattern));
}

function matchesPattern(relative: string, rawPattern: string): boolean {
  const pattern = normalizePattern(rawPattern);
  if (!pattern) return false;

  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3);
    return relative === base || relative.startsWith(`${base}/`);
  }

  if (!pattern.includes("*")) {
    return relative === pattern || relative.startsWith(`${pattern}/`);
  }

  return globToRegExp(pattern).test(relative);
}

function normalizePattern(pattern: string): string {
  return toPosix(pattern).replace(/^\.\/+/, "").replace(/\/+$/, "");
}

function toPosix(value: string): string {
  return value.replaceAll(path.sep, "/").replaceAll("\\", "/");
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += escapeRegExp(char);
    }
  }
  source += "$";
  return new RegExp(source);
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}
