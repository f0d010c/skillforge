import path from "node:path";
import fs from "fs-extra";
import { loadConfig } from "../lib/config.js";
import { parseMarkdownFrontmatter } from "../lib/frontmatter.js";
import { lintPath } from "../lib/lint.js";
import { countErrors } from "../lib/reporters.js";

export async function smokeCommand(targetPath: string): Promise<{ output: string; exitCode: number }> {
  const absolute = path.resolve(targetPath);
  const lines = [`SkillForge smoke: ${absolute}`];
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
    const score = await promptMatchScore(absolute, example.prompt);
    const passed = example.shouldTrigger ? score >= 2 : score < 2;
    lines.push(`${passed ? "OK  " : "FAIL"} example ${index + 1}: ${example.prompt}`);
    lines.push(`     match score: ${score}`);
    if (!passed) {
      return { output: lines.join("\n"), exitCode: 1 };
    }
  }

  return { output: lines.join("\n"), exitCode: 0 };
}

async function promptMatchScore(root: string, prompt: string): Promise<number> {
  const skillFiles = await findSkillFiles(root);
  const promptTokens = tokenize(prompt);
  let best = 0;

  for (const file of skillFiles) {
    const parsed = parseMarkdownFrontmatter(await fs.readFile(file, "utf8"));
    if (!parsed) continue;
    const name = String(parsed.data.name ?? "");
    const description = String(parsed.data.description ?? "");
    const descriptionTokens = tokenize(`${name} ${description}`);
    const overlap = Array.from(descriptionTokens).filter((token) => promptTokens.has(token)).length;
    const explicit = prompt.includes(`$${name}`) || prompt.toLowerCase().includes(name.replaceAll("-", " "));
    best = Math.max(best, overlap + (explicit ? 2 : 0));
  }

  return best;
}

async function findSkillFiles(root: string): Promise<string[]> {
  const direct = path.join(root, "SKILL.md");
  if (await fs.pathExists(direct)) return [direct];
  const files: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 5) return;
    for (const entry of await fs.readdir(dir)) {
      if (["node_modules", "dist", ".git"].includes(entry)) continue;
      const full = path.join(dir, entry);
      if (!(await fs.stat(full)).isDirectory()) continue;
      const skill = path.join(full, "SKILL.md");
      if (await fs.pathExists(skill)) files.push(skill);
      else await walk(full, depth + 1);
    }
  }
  await walk(root, 0);
  return files;
}

function tokenize(text: string): Set<string> {
  const stop = new Set(["this", "that", "with", "from", "when", "use", "skill", "codex", "needs", "workflow", "workflows"]);
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !stop.has(token))
  );
}
