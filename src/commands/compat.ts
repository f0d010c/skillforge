import path from "node:path";
import fs from "fs-extra";
import { lintPath } from "../lib/lint.js";
import { parseMarkdownFrontmatter } from "../lib/frontmatter.js";
import type { Issue, IssueImpact, IssueLevel } from "../types.js";

export type CompatTarget = "codex" | "claude" | "portable";
export type CompatFormat = "text" | "json";

interface CompatResult {
  targetPath: string;
  target: CompatTarget;
  issues: Issue[];
}

export async function compatCommand(targetPath: string, target: CompatTarget, format: CompatFormat): Promise<{ output: string; exitCode: number }> {
  const absolute = path.resolve(targetPath);
  const result = await compatPath(absolute, target);
  return {
    output: format === "json" ? JSON.stringify(result, null, 2) : formatCompatText(result),
    exitCode: result.issues.some((issue) => issue.level === "error") ? 1 : 0
  };
}

async function compatPath(targetPath: string, target: CompatTarget): Promise<CompatResult> {
  const issues: Issue[] = [];
  if (!(await fs.pathExists(targetPath))) {
    return {
      targetPath,
      target,
      issues: [compatIssue("error", "blocking", "compat.path.missing", "Target path does not exist.", targetPath)]
    };
  }

  if (target === "codex" || target === "portable") {
    const lint = await lintPath(targetPath, { profile: "source", strict: target === "portable" });
    issues.push(...lint.issues.map((issue) => ({ ...issue, code: `codex.${issue.code}` })));
  }

  if (target === "claude" || target === "portable") {
    issues.push(...(await claudeCompatIssues(targetPath)));
  }

  if (target === "portable") {
    issues.push(...(await portabilityIssues(targetPath)));
  }

  return { targetPath, target, issues };
}

async function claudeCompatIssues(root: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const skillFiles = await findSkillFiles(root);
  if (skillFiles.length === 0) {
    return [compatIssue("error", "blocking", "claude.skill.missing", "No SKILL.md file found for Claude-style skill compatibility.", root)];
  }

  for (const file of skillFiles) {
    const content = await fs.readFile(file, "utf8");
    const frontmatter = parseMarkdownFrontmatter(content);
    if (!frontmatter) {
      issues.push(compatIssue("error", "blocking", "claude.frontmatter.missing", "SKILL.md should start with YAML frontmatter.", file));
      continue;
    }
    if (typeof frontmatter.data.name !== "string" || frontmatter.data.name.trim() === "") {
      issues.push(compatIssue("error", "blocking", "claude.name.missing", "SKILL.md frontmatter should include a name.", file));
    }
    if (typeof frontmatter.data.description !== "string" || frontmatter.data.description.trim() === "") {
      issues.push(compatIssue("error", "blocking", "claude.description.missing", "SKILL.md frontmatter should include a description.", file));
    }
  }

  return issues;
}

async function portabilityIssues(root: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const skillFiles = await findSkillFiles(root);
  for (const file of skillFiles) {
    const content = await fs.readFile(file, "utf8");
    if (/\bClaude Code\b/i.test(content)) {
      issues.push(compatIssue("warning", "advisory", "portable.wording.claude", "SKILL.md mentions Claude Code directly; consider agent-neutral wording for portable skills.", file));
    }
    if (/\bCodex\b/i.test(content)) {
      issues.push(compatIssue("warning", "advisory", "portable.wording.codex", "SKILL.md mentions Codex directly; consider agent-neutral wording for portable skills.", file));
    }
    if (/\.claude\//i.test(content)) {
      issues.push(compatIssue("warning", "advisory", "portable.path.claude", "SKILL.md references .claude paths, which may not exist in other agents.", file));
    }
    if (/\.codex\//i.test(content) || /\.agents\//i.test(content)) {
      issues.push(compatIssue("warning", "advisory", "portable.path.codex", "SKILL.md references Codex-style paths, which may not exist in other agents.", file));
    }
  }

  issues.push(...(await scriptPortabilityIssues(root)));
  return issues;
}

async function scriptPortabilityIssues(root: string): Promise<Issue[]> {
  const scriptsDir = path.join(root, "scripts");
  if (!(await fs.pathExists(scriptsDir))) return [];
  const entries = await fs.readdir(scriptsDir);
  const extensions = new Set(entries.map((entry) => path.extname(entry).toLowerCase()).filter(Boolean));
  const issues: Issue[] = [];
  if (extensions.has(".sh") && !extensions.has(".ps1") && !extensions.has(".cmd") && !extensions.has(".bat") && !extensions.has(".js") && !extensions.has(".py")) {
    issues.push(compatIssue("warning", "advisory", "portable.scripts.unix-only", "scripts/ contains shell scripts without an obvious Windows-friendly alternative.", scriptsDir));
  }
  if (extensions.has(".ps1") && !extensions.has(".sh") && !extensions.has(".js") && !extensions.has(".py")) {
    issues.push(compatIssue("warning", "advisory", "portable.scripts.windows-only", "scripts/ contains PowerShell scripts without an obvious macOS/Linux-friendly alternative.", scriptsDir));
  }
  return issues;
}

async function findSkillFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 5) return;
    const skillPath = path.join(dir, "SKILL.md");
    if (await fs.pathExists(skillPath)) {
      found.push(skillPath);
      return;
    }
    for (const entry of await fs.readdir(dir)) {
      if (["node_modules", "dist", ".git", ".next", "coverage"].includes(entry)) continue;
      const full = path.join(dir, entry);
      const stat = await fs.stat(full);
      if (stat.isDirectory()) await walk(full, depth + 1);
    }
  }
  await walk(root, 0);
  return found.sort();
}

function compatIssue(level: IssueLevel, impact: IssueImpact, code: string, message: string, file: string): Issue {
  return { level, impact, code, message, file };
}

function formatCompatText(result: CompatResult): string {
  if (result.issues.length === 0) {
    return `SkillForge compat passed [${result.target}]: ${result.targetPath}`;
  }
  const blockers = result.issues.filter((issue) => issue.impact === "blocking").length;
  const advisories = result.issues.filter((issue) => issue.impact === "advisory").length;
  const lines = [`SkillForge compat found ${result.issues.length} issue(s) (${blockers} blocking, ${advisories} advisory) [${result.target}]:`];
  for (const issue of result.issues) {
    const impact = issue.impact ? ` ${issue.impact}` : "";
    const location = issue.file ? ` ${issue.file}` : "";
    lines.push(`[${issue.level.toUpperCase()}${impact}] ${issue.code}${location} - ${issue.message}`);
  }
  return lines.join("\n");
}
