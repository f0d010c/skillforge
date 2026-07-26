import path from "node:path";
import fs from "fs-extra";

const ROOT_FILES = new Set([
  "SKILL.md",
  ".mcp.json",
  ".app.json",
  "README.md",
  "LICENSE",
  "LICENSE.md",
  "NOTICE",
  "NOTICE.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
]);

const RUNTIME_DIRS = new Set([
  ".codex-plugin",
  ".claude-plugin",
  "skills",
  "agents",
  "assets",
  "commands",
  "references",
  "scripts",
  "hooks"
]);

const NEVER_PACKAGE = new Set([
  ".git",
  ".github",
  ".vscode",
  ".idea",
  "node_modules",
  "tests",
  "test",
  "coverage",
  "evals",
  "design-previews",
  "tmp",
  "temp"
]);

export async function packageFiles(source: string, outDir?: string): Promise<string[]> {
  const root = path.resolve(source);
  const excludedOutput = outDir ? path.resolve(outDir) : null;
  const selected = new Set<string>();

  for (const rootFile of ROOT_FILES) {
    await addPath(root, path.join(root, rootFile), selected, excludedOutput);
  }
  for (const directory of RUNTIME_DIRS) {
    await addPath(root, path.join(root, directory), selected, excludedOutput);
  }

  await addPackageJsonFiles(root, selected, excludedOutput);
  await addReferencedFiles(root, selected, excludedOutput);

  return Array.from(selected).sort((a, b) => a.localeCompare(b));
}

async function addPackageJsonFiles(root: string, selected: Set<string>, excludedOutput: string | null): Promise<void> {
  const packageJsonPath = path.join(root, "package.json");
  if (!(await fs.pathExists(packageJsonPath))) return;
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as { files?: unknown };
    if (!Array.isArray(packageJson.files)) return;
    for (const entry of packageJson.files) {
      if (typeof entry !== "string" || entry.includes("*")) continue;
      await addPath(root, path.resolve(root, entry), selected, excludedOutput);
    }
  } catch {
    // Lint reports invalid package metadata separately; packaging remains bounded.
  }
}

async function addReferencedFiles(root: string, selected: Set<string>, excludedOutput: string | null): Promise<void> {
  const visited = new Set<string>();
  let pending = Array.from(selected).filter((relative) => relative.endsWith(".md"));
  while (pending.length > 0) {
    const relative = pending.shift()!;
    if (visited.has(relative)) continue;
    visited.add(relative);
    const file = path.join(root, relative);
    const content = await fs.readFile(file, "utf8");
    for (const reference of localReferences(content)) {
      const resolved = path.resolve(path.dirname(file), reference);
      if (!isInside(root, resolved)) continue;
      const before = new Set(selected);
      await addPath(root, resolved, selected, excludedOutput);
      for (const added of selected) {
        if (!before.has(added) && added.endsWith(".md")) pending.push(added);
      }
    }
  }
}

function localReferences(content: string): string[] {
  const references = new Set<string>();
  for (const match of content.matchAll(/!?\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    references.add(match[1]);
  }
  for (const match of content.matchAll(
    /`((?:\.{1,2}\/)?(?:scripts|references|assets|agents|commands|docs)\/[A-Za-z0-9._/-]+)`/g
  )) {
    references.add(match[1]);
  }
  return Array.from(references)
    .map((reference) => reference.split("#")[0].split("?")[0])
    .filter((reference) => reference && !/^[a-z][a-z0-9+.-]*:/i.test(reference));
}

async function addPath(
  root: string,
  candidate: string,
  selected: Set<string>,
  excludedOutput: string | null
): Promise<void> {
  if (!isInside(root, candidate) || isInsideExcluded(excludedOutput, candidate) || !(await fs.pathExists(candidate))) {
    return;
  }
  const relative = path.relative(root, candidate).replaceAll("\\", "/");
  if (relative.split("/").some((part) => NEVER_PACKAGE.has(part))) return;
  const stat = await fs.lstat(candidate);
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to package symbolic link: ${relative}`);
  }
  if (stat.isFile()) {
    if (!relative.endsWith(".log") && !relative.endsWith(".pyc") && !path.basename(relative).startsWith(".env")) {
      selected.add(relative);
    }
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of await fs.readdir(candidate)) {
    await addPath(root, path.join(candidate, entry), selected, excludedOutput);
  }
}

function isInsideExcluded(excluded: string | null, candidate: string): boolean {
  return excluded !== null && isInside(excluded, candidate);
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
