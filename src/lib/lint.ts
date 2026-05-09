import path from "node:path";
import fs from "fs-extra";
import YAML from "yaml";
import { z } from "zod";
import type { Issue, LintResult, SkillForgeConfig } from "../types.js";
import { loadConfig } from "./config.js";
import { parseMarkdownFrontmatter } from "./frontmatter.js";
import { hyphenName } from "./paths.js";

const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1)
});

const openAiYamlSchema = z
  .object({
    interface: z
      .object({
        display_name: z.string().optional(),
        short_description: z.string().optional(),
        icon_small: z.string().optional(),
        icon_large: z.string().optional(),
        brand_color: z.string().optional(),
        default_prompt: z.string().optional()
      })
      .passthrough()
      .optional(),
    policy: z
      .object({
        allow_implicit_invocation: z.boolean().optional()
      })
      .passthrough()
      .optional(),
    dependencies: z.record(z.unknown()).optional()
  })
  .passthrough();

const pluginManifestSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    author: z.unknown().optional(),
    homepage: z.string().optional(),
    repository: z.string().optional(),
    license: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    skills: z.union([z.string(), z.array(z.string())]).optional(),
    mcpServers: z.string().optional(),
    apps: z.string().optional(),
    hooks: z.union([z.string(), z.array(z.string()), z.record(z.unknown()), z.array(z.record(z.unknown()))]).optional(),
    interface: z
      .object({
        displayName: z.string().optional(),
        shortDescription: z.string().optional(),
        longDescription: z.string().optional(),
        developerName: z.string().optional(),
        category: z.string().optional(),
        capabilities: z.array(z.string()).optional(),
        websiteURL: z.string().optional(),
        privacyPolicyURL: z.string().optional(),
        termsOfServiceURL: z.string().optional(),
        defaultPrompt: z.union([z.string(), z.array(z.string())]).optional(),
        brandColor: z.string().optional(),
        composerIcon: z.string().optional(),
        logo: z.string().optional(),
        screenshots: z.array(z.string()).optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

const ignoredDirs = new Set(["node_modules", "dist", ".git", ".next", "coverage", "tmp-e2e"]);

export async function lintPath(targetPath: string): Promise<LintResult> {
  const absolute = path.resolve(targetPath);

  if (!(await fs.pathExists(absolute))) {
    return {
      targetPath: absolute,
      kind: "unknown",
      issues: [{ level: "error", code: "path.missing", message: "Target path does not exist.", file: absolute }]
    };
  }

  const direct = await lintSingle(absolute);
  if (direct.kind !== "unknown") {
    return direct;
  }

  const children = await discoverLintTargets(absolute);
  if (children.length === 0) {
    return direct;
  }

  const results = await Promise.all(children.map((child) => lintSingle(child)));
  return {
    targetPath: absolute,
    kind: "collection",
    checkedPaths: results.map((result) => result.targetPath),
    issues: results.flatMap((result) => result.issues)
  };
}

async function lintSingle(root: string): Promise<LintResult> {
  const issues: Issue[] = [];
  const skillPath = path.join(root, "SKILL.md");
  const pluginPath = path.join(root, ".codex-plugin", "plugin.json");
  const isSkill = await fs.pathExists(skillPath);
  const isPlugin = await fs.pathExists(pluginPath);
  const config = await loadConfig(root).catch((error): SkillForgeConfig => {
    issues.push({ level: "error", code: "config.invalid", message: String(error), file: path.join(root, "skillforge.json") });
    return {};
  });

  if (isSkill) {
    issues.push(...(await lintSkill(root, config.checks?.maxSkillMdLines ?? 500)));
  }
  if (isPlugin) {
    issues.push(...(await lintPlugin(root)));
  }
  if (!isSkill && !isPlugin) {
    issues.push({
      level: "error",
      code: "shape.unknown",
      message: "Expected a skill folder with SKILL.md, a plugin folder with .codex-plugin/plugin.json, or a repository containing such folders.",
      file: root
    });
  }

  if (config.checks?.requireOpenAiYaml && !(await fs.pathExists(path.join(root, "agents", "openai.yaml")))) {
    issues.push({
      level: "error",
      code: "metadata.openai-yaml.missing",
      message: "skillforge.json requires agents/openai.yaml, but it was not found.",
      file: path.join(root, "agents", "openai.yaml")
    });
  }

  if (config.checks?.allowScripts === false && (await fs.pathExists(path.join(root, "scripts")))) {
    issues.push({
      level: "error",
      code: "scripts.disallowed",
      message: "skillforge.json disallows scripts, but a scripts directory exists.",
      file: path.join(root, "scripts")
    });
  }

  return { targetPath: root, kind: isPlugin ? "plugin" : isSkill ? "skill" : "unknown", issues };
}

async function discoverLintTargets(root: string): Promise<string[]> {
  const found = new Set<string>();
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 5) return;
    for (const entry of await fs.readdir(dir)) {
      if (ignoredDirs.has(entry)) continue;
      const full = path.join(dir, entry);
      const stat = await fs.stat(full);
      if (!stat.isDirectory()) continue;
      if ((await fs.pathExists(path.join(full, "SKILL.md"))) || (await fs.pathExists(path.join(full, ".codex-plugin", "plugin.json")))) {
        found.add(full);
        continue;
      }
      await walk(full, depth + 1);
    }
  }
  await walk(root, 0);
  return Array.from(found).sort();
}

async function lintSkill(root: string, maxSkillMdLines: number): Promise<Issue[]> {
  const issues: Issue[] = [];
  const skillPath = path.join(root, "SKILL.md");
  const content = await fs.readFile(skillPath, "utf8");
  const frontmatter = parseMarkdownFrontmatter(content);

  if (!frontmatter) {
    return [{ level: "error", code: "skill.frontmatter.missing", message: "SKILL.md must start with YAML frontmatter.", file: skillPath }];
  }

  const parsed = skillFrontmatterSchema.safeParse(frontmatter.data);
  if (!parsed.success) {
    issues.push({ level: "error", code: "skill.frontmatter.invalid", message: parsed.error.message, file: skillPath });
  } else {
    const { name, description } = parsed.data;
    if (name !== hyphenName(name) || name.length > 64) {
      issues.push({ level: "error", code: "skill.name.invalid", message: "Skill name must be lowercase hyphen-case and <= 64 characters.", file: skillPath });
    }
    if (name !== path.basename(root)) {
      issues.push({ level: "warning", code: "skill.name.folder-mismatch", message: "Skill folder name should match frontmatter name for predictable installs.", file: skillPath });
    }
    issues.push(...descriptionIssues(description, skillPath));
  }

  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > maxSkillMdLines) {
    issues.push({
      level: "warning",
      code: "skill.body.large",
      message: `SKILL.md has ${lineCount} lines; consider moving detail into references/.`,
      file: skillPath
    });
  }

  issues.push(...(await referenceIssues(root, content, skillPath)));
  issues.push(...(await scriptIssues(root, content)));
  issues.push(...(await openAiYamlIssues(root)));
  return issues;
}

function descriptionIssues(description: string, file: string): Issue[] {
  const issues: Issue[] = [];
  const lower = description.toLowerCase();
  if (description.length < 80 || !/\b(use|when|triggers?|applies|for)\b/.test(lower)) {
    issues.push({ level: "warning", code: "skill.description.vague", message: "Description should clearly say what the skill does and when Codex should use it.", file });
  }
  if (!/\b(when|use|trigger|applies|for)\b/.test(lower.slice(0, 160))) {
    issues.push({ level: "warning", code: "skill.description.trigger-late", message: "Front-load trigger words because Codex may shorten large skill lists.", file });
  }
  if (description.length > 700) {
    issues.push({ level: "warning", code: "skill.description.long", message: "Description is long; keep trigger metadata concise and move details to the body.", file });
  }
  return issues;
}

async function referenceIssues(root: string, content: string, file: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const markdownLinks = Array.from(content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)).map((match) => match[1]);
  const inlinePaths = Array.from(content.matchAll(/`((?:scripts|references|assets|agents)\/[^`]+)`/g)).map((match) => match[1]);

  for (const ref of [...markdownLinks, ...inlinePaths]) {
    if (/^[a-z]+:\/\//i.test(ref) || ref.startsWith("#")) continue;
    const clean = ref.split("#")[0];
    if (!clean) continue;
    const fullPath = path.resolve(path.dirname(file), clean);
    if (!isInside(root, fullPath) || !(await fs.pathExists(fullPath))) {
      issues.push({ level: "error", code: "reference.missing", message: `Referenced file does not exist: ${ref}`, file });
    }
  }
  return issues;
}

async function scriptIssues(root: string, skillMd: string): Promise<Issue[]> {
  const scriptsDir = path.join(root, "scripts");
  if (!(await fs.pathExists(scriptsDir))) return [];
  const issues: Issue[] = [];
  for (const entry of await fs.readdir(scriptsDir)) {
    const fullPath = path.join(scriptsDir, entry);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) continue;
    if (!/\.(js|mjs|cjs|ts|py|ps1|sh|bat|cmd)$/i.test(entry)) {
      issues.push({ level: "warning", code: "script.extension.unknown", message: "Script has an uncommon extension; include clear invocation notes in SKILL.md.", file: fullPath });
    }
    if (!skillMd.includes(`scripts/${entry}`)) {
      issues.push({ level: "warning", code: "script.unreferenced", message: "Script is not mentioned in SKILL.md, so Codex may not know when to use it.", file: fullPath });
    }
  }
  return issues;
}

async function openAiYamlIssues(root: string): Promise<Issue[]> {
  const file = path.join(root, "agents", "openai.yaml");
  if (!(await fs.pathExists(file))) return [];
  let raw: unknown;
  try {
    raw = YAML.parse(await fs.readFile(file, "utf8"));
    const parsed = openAiYamlSchema.parse(raw);
    const issues: Issue[] = [];
    if (raw && typeof raw === "object" && ["display_name", "short_description", "default_prompt"].some((key) => key in (raw as Record<string, unknown>))) {
      issues.push({ level: "error", code: "metadata.openai-yaml.legacy-shape", message: "agents/openai.yaml fields must live under interface:, not at the top level.", file });
    }
    for (const asset of [parsed.interface?.icon_small, parsed.interface?.icon_large].filter(Boolean) as string[]) {
      issues.push(...(await pluginPathIssues(root, file, asset, "metadata.asset")));
    }
    return issues;
  } catch (error) {
    return [{ level: "error", code: "metadata.openai-yaml.invalid", message: String(error), file }];
  }
}

async function lintPlugin(root: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const manifestPath = path.join(root, ".codex-plugin", "plugin.json");
  let manifest: z.infer<typeof pluginManifestSchema>;

  try {
    manifest = pluginManifestSchema.parse(JSON.parse(await fs.readFile(manifestPath, "utf8")));
  } catch (error) {
    return [{ level: "error", code: "plugin.manifest.invalid", message: String(error), file: manifestPath }];
  }

  const folderName = path.basename(root);
  if (manifest.name !== folderName) {
    issues.push({ level: "error", code: "plugin.name.mismatch", message: `Manifest name "${manifest.name}" must match folder name "${folderName}".`, file: manifestPath });
  }
  if (manifest.name !== hyphenName(manifest.name) || manifest.name.length > 64) {
    issues.push({ level: "error", code: "plugin.name.invalid", message: "Plugin name must be lowercase hyphen-case and <= 64 characters.", file: manifestPath });
  }
  if (!manifest.version) {
    issues.push({ level: "warning", code: "plugin.version.missing", message: "Published plugins should include a version.", file: manifestPath });
  }
  if (!manifest.description || manifest.description.length < 20) {
    issues.push({ level: "warning", code: "plugin.description.vague", message: "Published plugins should include a useful description.", file: manifestPath });
  }

  issues.push(...(await pluginSkillsIssues(root, manifestPath, manifest.skills)));
  issues.push(...(await optionalManifestPath(root, manifestPath, manifest.mcpServers, "plugin.mcpServers")));
  issues.push(...(await optionalManifestPath(root, manifestPath, manifest.apps, "plugin.apps")));
  issues.push(...(await pluginHooksIssues(root, manifestPath, manifest.hooks)));

  const defaultHooks = path.join(root, "hooks", "hooks.json");
  if (!manifest.hooks && (await fs.pathExists(defaultHooks))) {
    issues.push(...(await parseJsonFile(defaultHooks, "plugin.hooks.invalid")));
    issues.push(hooksFeatureFlagIssue(manifestPath));
  }

  for (const asset of [manifest.interface?.composerIcon, manifest.interface?.logo, ...(manifest.interface?.screenshots ?? [])].filter(Boolean) as string[]) {
    issues.push(...(await pluginPathIssues(root, manifestPath, asset, "plugin.asset")));
  }

  return issues;
}

async function pluginSkillsIssues(root: string, manifestPath: string, skills?: string | string[]): Promise<Issue[]> {
  const issues: Issue[] = [];
  if (!skills) return issues;
  for (const ref of Array.isArray(skills) ? skills : [skills]) {
    issues.push(...(await pluginPathIssues(root, manifestPath, ref, "plugin.skills")));
    const full = path.resolve(root, ref);
    if (!(await fs.pathExists(full))) continue;
    const stat = await fs.stat(full);
    if (!stat.isDirectory()) continue;
    const directSkill = await fs.pathExists(path.join(full, "SKILL.md"));
    const entries = await fs.readdir(full);
    const skillFolders = await Promise.all(entries.map(async (entry) => ((await fs.pathExists(path.join(full, entry, "SKILL.md"))) ? path.join(full, entry) : null)));
    if (!directSkill && !skillFolders.some(Boolean)) {
      issues.push({ level: "error", code: "plugin.skills.empty", message: `Skills path does not contain any SKILL.md files: ${ref}`, file: manifestPath });
    }
    if (directSkill) issues.push(...(await lintSkill(full, 500)));
    for (const skillFolder of skillFolders.filter(Boolean) as string[]) {
      issues.push(...(await lintSkill(skillFolder, 500)));
    }
  }
  return issues;
}

async function pluginHooksIssues(root: string, manifestPath: string, hooks?: z.infer<typeof pluginManifestSchema>["hooks"]): Promise<Issue[]> {
  if (!hooks) return [];
  const issues: Issue[] = [hooksFeatureFlagIssue(manifestPath)];
  if (typeof hooks === "string") {
    issues.push(...(await optionalManifestPath(root, manifestPath, hooks, "plugin.hooks")));
    issues.push(...(await parseJsonFile(path.resolve(root, hooks), "plugin.hooks.invalid")));
  } else if (Array.isArray(hooks) && hooks.every((hook) => typeof hook === "string")) {
    for (const hook of hooks as string[]) {
      issues.push(...(await optionalManifestPath(root, manifestPath, hook, "plugin.hooks")));
      issues.push(...(await parseJsonFile(path.resolve(root, hook), "plugin.hooks.invalid")));
    }
  }
  return issues;
}

function hooksFeatureFlagIssue(file: string): Issue {
  return { level: "warning", code: "plugin.hooks.feature-flag", message: "Hooks require Codex hook support; document the codex_hooks feature flag for users.", file };
}

async function optionalManifestPath(root: string, manifestPath: string, ref: string | undefined, code: string): Promise<Issue[]> {
  return ref ? pluginPathIssues(root, manifestPath, ref, code) : [];
}

async function pluginPathIssues(root: string, manifestPath: string, ref: string, code: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  if (!ref.startsWith("./")) {
    issues.push({ level: "error", code: `${code}.relative`, message: `Manifest path must start with ./ and be relative to the plugin root: ${ref}`, file: manifestPath });
  }
  const full = path.resolve(root, ref);
  if (!isInside(root, full)) {
    issues.push({ level: "error", code: `${code}.outside-root`, message: `Manifest path must stay inside the plugin root: ${ref}`, file: manifestPath });
  } else if (!(await fs.pathExists(full))) {
    issues.push({ level: "error", code: `${code}.missing`, message: `Manifest path does not exist: ${ref}`, file: manifestPath });
  }
  return issues;
}

async function parseJsonFile(file: string, code: string): Promise<Issue[]> {
  if (!(await fs.pathExists(file))) return [];
  try {
    JSON.parse(await fs.readFile(file, "utf8"));
    return [];
  } catch (error) {
    return [{ level: "error", code, message: String(error), file }];
  }
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
