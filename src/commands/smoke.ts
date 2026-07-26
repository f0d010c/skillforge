import path from "node:path";
import fs from "fs-extra";
import { loadConfig } from "../lib/config.js";
import { parseMarkdownFrontmatter } from "../lib/frontmatter.js";
import { defaultIgnoredDirs, isIgnoredPath } from "../lib/ignore.js";
import { lintPath } from "../lib/lint.js";
import { countErrors } from "../lib/reporters.js";
import type { SkillForgeConfig } from "../types.js";

export async function smokeCommand(targetPath: string): Promise<{ output: string; exitCode: number }> {
  const absolute = path.resolve(targetPath);
  const lines = [`SkillForge static smoke: ${absolute}`];
  const lint = await lintPath(absolute);
  const errors = countErrors(lint.issues);
  if (errors > 0) {
    lines.push(`FAIL lint: ${errors} error(s)`);
    return { output: lines.join("\n"), exitCode: 1 };
  }
  lines.push("OK   lint");

  const config = await loadConfig(absolute);
  const examples = config.examples ?? [];
  if (examples.length === 0) {
    lines.push("WARN examples: no skillforge.json examples declared");
    return { output: lines.join("\n"), exitCode: 0 };
  }

  for (const [index, example] of examples.entries()) {
    const scores = await promptMatchScores(absolute, example.prompt);
    const best = scores[0];
    const expected = example.expectedSkill
      ? scores.find((candidate) => candidate.name === example.expectedSkill)
      : undefined;
    const score = expected?.score ?? best?.score ?? 0;
    const passed = example.shouldTrigger
      ? example.expectedSkill
        ? score >= 2 && best?.name === example.expectedSkill
        : score >= 2
      : (best?.score ?? 0) < 2;
    lines.push(`${passed ? "OK  " : "FAIL"} example ${index + 1}: ${example.prompt}`);
    lines.push(
      `     match: ${best?.name ?? "none"} (${best?.score ?? 0})${example.expectedSkill ? `; expected ${example.expectedSkill} (${score})` : ""}`
    );
    if (!passed) {
      return { output: lines.join("\n"), exitCode: 1 };
    }
  }

  return { output: lines.join("\n"), exitCode: 0 };
}

async function promptMatchScores(root: string, prompt: string): Promise<Array<{ name: string; score: number }>> {
  const skillFiles = await findSkillFiles(root);
  const promptTokens = tokenize(prompt);
  const scores: Array<{ name: string; score: number }> = [];

  for (const file of skillFiles) {
    const parsed = parseMarkdownFrontmatter(await fs.readFile(file, "utf8"));
    if (!parsed) continue;
    const name = String(parsed.data.name ?? "");
    const description = String(parsed.data.description ?? "");
    const descriptionTokens = tokenize(`${name} ${description}`);
    const overlap = Array.from(descriptionTokens).filter((token) => promptTokens.has(token)).length;
    const explicit = prompt.includes(`$${name}`) || prompt.toLowerCase().includes(name.replaceAll("-", " "));
    scores.push({ name, score: overlap + (explicit ? 2 : 0) });
  }

  return scores.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

async function findSkillFiles(root: string): Promise<string[]> {
  const direct = path.join(root, "SKILL.md");
  if (await fs.pathExists(direct)) return [direct];
  const config = await loadConfig(root).catch((): SkillForgeConfig => ({}));
  const ignorePatterns = config.lint?.ignore ?? [];
  const files: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 5) return;
    for (const entry of await fs.readdir(dir)) {
      if (defaultIgnoredDirs.has(entry)) continue;
      const full = path.join(dir, entry);
      if (!(await fs.stat(full)).isDirectory()) continue;
      if (isIgnoredPath(root, full, ignorePatterns)) continue;
      const skill = path.join(full, "SKILL.md");
      if (await fs.pathExists(skill)) files.push(skill);
      else await walk(full, depth + 1);
    }
  }
  await walk(root, 0);
  return files;
}

function tokenize(text: string): Set<string> {
  const stop = new Set([
    "this",
    "that",
    "with",
    "from",
    "when",
    "use",
    "skill",
    "codex",
    "needs",
    "workflow",
    "workflows"
  ]);
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !stop.has(token))
  );
}
