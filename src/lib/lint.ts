import path from "node:path";
import fs from "fs-extra";
import YAML from "yaml";
import { z } from "zod";
import type { Issue, LintOptions, LintResult, SkillForgeConfig } from "../types.js";
import { loadConfig } from "./config.js";
import { openAiYamlSchema, pluginManifestSchema, type PluginManifest } from "./contracts.js";
import { parseMarkdownFrontmatter } from "./frontmatter.js";
import { defaultIgnoredDirs, isIgnoredPath } from "./ignore.js";
import { hyphenName } from "./paths.js";

const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  "disable-model-invocation": z.literal(false).optional(),
  disable_model_invocation: z.literal(false).optional()
});

const advisoryCodes = new Set([
  "plugin.name.mismatch",
  "skill.description.vague",
  "skill.description.trigger-late",
  "skill.description.long",
  "skill.body.large",
  "script.unreferenced"
]);

export async function lintPath(targetPath: string, options: LintOptions = {}): Promise<LintResult> {
  const absolute = path.resolve(targetPath);
  const lintOptions = normalizeLintOptions(options);

  if (!(await fs.pathExists(absolute))) {
    return {
      targetPath: absolute,
      kind: "unknown",
      profile: lintOptions.profile,
      issues: [
        {
          level: "error",
          impact: "blocking",
          code: "path.missing",
          message: "Target path does not exist.",
          file: absolute
        }
      ]
    };
  }

  const direct = await lintSingle(absolute, lintOptions);
  if (direct.kind !== "unknown") {
    return applyLintOptions(direct, lintOptions);
  }

  const collectionIssues: Issue[] = [];
  const collectionConfig = await loadConfig(absolute).catch((error): SkillForgeConfig => {
    collectionIssues.push({
      level: "error",
      impact: "blocking",
      code: "config.invalid",
      message: String(error),
      file: path.join(absolute, "skillforge.json")
    });
    return {};
  });
  const collectionOptions = {
    ...lintOptions,
    ignore: [...(lintOptions.ignore ?? []), ...(collectionConfig.lint?.ignore ?? [])]
  };
  const children = await discoverLintTargets(absolute, collectionOptions.ignore);
  if (children.length === 0) {
    if (collectionConfig.lint?.allowEmptyCollection) {
      return {
        targetPath: absolute,
        kind: "collection",
        profile: lintOptions.profile,
        checkedPaths: [],
        issues: filterIssues(collectionIssues, collectionOptions)
      };
    }
    return direct;
  }

  const results = await Promise.all(children.map((child) => lintSingle(child, collectionOptions)));
  return {
    targetPath: absolute,
    kind: "collection",
    profile: lintOptions.profile,
    checkedPaths: results.map((result) => result.targetPath),
    issues: filterIssues([...collectionIssues, ...results.flatMap((result) => result.issues)], collectionOptions)
  };
}

function applyLintOptions(result: LintResult, options: LintOptions): LintResult {
  return { ...result, profile: options.profile, issues: filterIssues(result.issues, options) };
}

function normalizeLintOptions(options: LintOptions): Required<Pick<LintOptions, "profile">> & LintOptions {
  return { ...options, profile: options.profile ?? "source" };
}

function filterIssues(issues: Issue[], options: LintOptions): Issue[] {
  if (options.strict) return issues;
  return issues.filter((issue) => !advisoryCodes.has(issue.code));
}

async function lintSingle(root: string, options: LintOptions): Promise<LintResult> {
  const issues: Issue[] = [];
  const skillPath = path.join(root, "SKILL.md");
  const pluginPath = path.join(root, ".codex-plugin", "plugin.json");
  const isSkill = await fs.pathExists(skillPath);
  const isPlugin = await fs.pathExists(pluginPath);
  const config = await loadConfig(root).catch((error): SkillForgeConfig => {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "config.invalid",
      message: String(error),
      file: path.join(root, "skillforge.json")
    });
    return {};
  });

  if (isSkill) {
    issues.push(...(await lintSkill(root, config.checks?.maxSkillMdLines ?? 500, options)));
  }
  if (isPlugin) {
    issues.push(...(await lintPlugin(root, options)));
  }
  if (!isSkill && !isPlugin) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "shape.unknown",
      message:
        "Expected a skill folder with SKILL.md, a plugin folder with .codex-plugin/plugin.json, or a repository containing such folders.",
      file: root
    });
  }

  if (config.checks?.requireOpenAiYaml && !(await fs.pathExists(path.join(root, "agents", "openai.yaml")))) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "metadata.openai-yaml.missing",
      message: "skillforge.json requires agents/openai.yaml, but it was not found.",
      file: path.join(root, "agents", "openai.yaml")
    });
  }

  if (config.checks?.allowScripts === false && (await fs.pathExists(path.join(root, "scripts")))) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "scripts.disallowed",
      message: "skillforge.json disallows scripts, but a scripts directory exists.",
      file: path.join(root, "scripts")
    });
  }

  return {
    targetPath: root,
    kind: isPlugin ? "plugin" : isSkill ? "skill" : "unknown",
    profile: options.profile,
    issues
  };
}

async function discoverLintTargets(root: string, ignorePatterns: string[] = []): Promise<string[]> {
  const found = new Set<string>();
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 5) return;
    for (const entry of await fs.readdir(dir)) {
      if (defaultIgnoredDirs.has(entry)) continue;
      const full = path.join(dir, entry);
      const stat = await fs.stat(full);
      if (!stat.isDirectory()) continue;
      if (isIgnoredPath(root, full, ignorePatterns)) continue;
      if (
        (await fs.pathExists(path.join(full, "SKILL.md"))) ||
        (await fs.pathExists(path.join(full, ".codex-plugin", "plugin.json")))
      ) {
        found.add(full);
        continue;
      }
      await walk(full, depth + 1);
    }
  }
  await walk(root, 0);
  return Array.from(found).sort();
}

async function lintSkill(
  root: string,
  maxSkillMdLines: number,
  options: LintOptions,
  referenceRoot = root
): Promise<Issue[]> {
  const issues: Issue[] = [];
  const skillPath = path.join(root, "SKILL.md");
  const content = await fs.readFile(skillPath, "utf8");
  const frontmatter = parseMarkdownFrontmatter(content);

  if (!frontmatter) {
    return [
      {
        level: "error",
        impact: "blocking",
        code: "skill.frontmatter.missing",
        message: "SKILL.md must start with YAML frontmatter.",
        file: skillPath
      }
    ];
  }

  const parsed = skillFrontmatterSchema.safeParse(frontmatter.data);
  if (!parsed.success) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "skill.frontmatter.invalid",
      message: parsed.error.message,
      file: skillPath
    });
  } else {
    const { name, description } = parsed.data;
    if (name !== hyphenName(name) || name.length > 64) {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "skill.name.invalid",
        message: "Skill name must be lowercase hyphen-case and <= 64 characters.",
        file: skillPath
      });
    }
    if (
      name !== path.basename(root) &&
      !root.includes(`${path.sep}plugins${path.sep}`) &&
      !root.includes(`${path.sep}.agents${path.sep}skills${path.sep}`)
    ) {
      issues.push({
        level: "warning",
        impact: "advisory",
        code: "skill.name.folder-mismatch",
        message: "Skill folder name should match frontmatter name for predictable installs.",
        file: skillPath
      });
    }
    issues.push(...descriptionIssues(description, skillPath));
  }

  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > maxSkillMdLines) {
    issues.push({
      level: "warning",
      impact: "advisory",
      code: "skill.body.large",
      message: `SKILL.md has ${lineCount} lines; consider moving detail into references/.`,
      file: skillPath
    });
  }

  issues.push(...(await referenceIssues(referenceRoot, content, skillPath)));
  issues.push(...(await scriptIssues(root, content)));
  issues.push(...(await openAiYamlIssues(root, options)));
  return issues;
}

function descriptionIssues(description: string, file: string): Issue[] {
  const issues: Issue[] = [];
  const lower = description.toLowerCase();
  if (description.length < 80 || !/\b(use|when|triggers?|applies|for)\b/.test(lower)) {
    issues.push({
      level: "warning",
      impact: "advisory",
      code: "skill.description.vague",
      message: "Description should clearly say what the skill does and when Codex should use it.",
      file
    });
  }
  if (!/\b(when|use|trigger|applies|for)\b/.test(lower.slice(0, 160))) {
    issues.push({
      level: "warning",
      impact: "advisory",
      code: "skill.description.trigger-late",
      message: "Front-load trigger words because Codex may shorten large skill lists.",
      file
    });
  }
  if (description.length > 700) {
    issues.push({
      level: "warning",
      impact: "advisory",
      code: "skill.description.long",
      message: "Description is long; keep trigger metadata concise and move details to the body.",
      file
    });
  }
  return issues;
}

async function referenceIssues(root: string, content: string, file: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const markdownLinks = Array.from(content.matchAll(/!?\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)).map(
    (match) => ({ ref: match[1], impact: "blocking" as const })
  );
  const inlinePaths = Array.from(
    content.matchAll(/`((?:\.{1,2}\/)?(?:scripts|references|assets|agents)\/[A-Za-z0-9._/-]+)`/g)
  ).map((match) => ({
    ref: match[1],
    impact: "advisory" as const
  }));

  for (const { ref, impact } of [...markdownLinks, ...inlinePaths]) {
    if (!shouldCheckLocalReference(ref)) continue;
    const clean = ref.split("#")[0];
    if (!clean || clean.includes("<") || clean.includes(">") || clean.includes("*") || clean.includes("\\")) continue;
    const fullPath = path.resolve(path.dirname(file), clean);
    if (!isInside(root, fullPath) || !(await fs.pathExists(fullPath))) {
      issues.push({
        level: impact === "blocking" ? "error" : "warning",
        impact,
        code: "reference.missing",
        message: `Referenced file does not exist: ${ref}`,
        file
      });
    }
  }
  return issues;
}

function shouldCheckLocalReference(ref: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("#")) return false;
  const clean = ref.split("#")[0].split("?")[0];
  if (!clean || clean === "." || clean === "..") return false;
  if (clean.startsWith("./") || clean.startsWith("../") || clean.startsWith("/")) return true;
  if (clean.includes("/")) return true;
  return /\.[A-Za-z0-9]{1,8}$/.test(clean);
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
      issues.push({
        level: "warning",
        impact: "advisory",
        code: "script.extension.unknown",
        message: "Script has an uncommon extension; include clear invocation notes in SKILL.md.",
        file: fullPath
      });
    }
    if (!skillMd.includes(`scripts/${entry}`)) {
      issues.push({
        level: "warning",
        impact: "advisory",
        code: "script.unreferenced",
        message: "Script is not mentioned in SKILL.md, so Codex may not know when to use it.",
        file: fullPath
      });
    }
  }
  return issues;
}

async function openAiYamlIssues(root: string, options: LintOptions): Promise<Issue[]> {
  const file = path.join(root, "agents", "openai.yaml");
  if (!(await fs.pathExists(file))) return [];
  let raw: unknown;
  try {
    raw = YAML.parse(await fs.readFile(file, "utf8"));
    const issues: Issue[] = [];
    if (
      raw &&
      typeof raw === "object" &&
      ["display_name", "short_description", "default_prompt"].some((key) => key in (raw as Record<string, unknown>))
    ) {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "metadata.openai-yaml.legacy-shape",
        message: "agents/openai.yaml fields must live under interface:, not at the top level.",
        file
      });
      return issues;
    }
    const parsed = openAiYamlSchema.parse(raw);
    for (const asset of [parsed.interface?.icon_small, parsed.interface?.icon_large].filter(Boolean) as string[]) {
      issues.push(...(await pluginPathIssues(root, file, asset, "metadata.asset", options)));
    }
    return issues;
  } catch (error) {
    return [{ level: "error", impact: "blocking", code: "metadata.openai-yaml.invalid", message: String(error), file }];
  }
}

async function lintPlugin(root: string, options: LintOptions): Promise<Issue[]> {
  const issues: Issue[] = [];
  const manifestPath = path.join(root, ".codex-plugin", "plugin.json");
  let manifest: PluginManifest;
  let manifestJson: unknown;

  try {
    manifestJson = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    manifest = pluginManifestSchema.parse(manifestJson);
  } catch (error) {
    return [
      {
        level: "error",
        impact: "blocking",
        code: "plugin.manifest.invalid",
        message: String(error),
        file: manifestPath
      }
    ];
  }

  if (containsTodoPlaceholder(manifestJson)) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "plugin.manifest.placeholder",
      message: "Plugin manifest still contains an unresolved [TODO: ...] placeholder.",
      file: manifestPath
    });
  }

  const folderName = path.basename(root);
  if (manifest.name !== folderName) {
    issues.push({
      level: "warning",
      impact: "advisory",
      code: "plugin.name.mismatch",
      message: `Manifest name "${manifest.name}" differs from folder name "${folderName}". This is valid for some repo-level packages but can confuse local plugin installs.`,
      file: manifestPath
    });
  }
  if (manifest.name !== hyphenName(manifest.name) || manifest.name.length > 64) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "plugin.name.invalid",
      message: "Plugin name must be lowercase hyphen-case and <= 64 characters.",
      file: manifestPath
    });
  }
  if (manifest.description.length < 20) {
    issues.push({
      level: "warning",
      impact: "advisory",
      code: "plugin.description.vague",
      message: "Published plugins should include a useful description.",
      file: manifestPath
    });
  }

  issues.push(...(await pluginSkillsIssues(root, manifestPath, manifest.skills, options)));
  issues.push(...(await marketplaceMetadataIssues(root, manifestPath, manifest, options)));
  issues.push(...(await readmeIssues(root, options)));
  issues.push(...(await mcpServersIssues(root, manifestPath, manifest.mcpServers, options)));
  issues.push(...(await appManifestIssues(root, manifestPath, manifest.apps, options)));

  for (const asset of [
    manifest.interface.composerIcon,
    manifest.interface.logo,
    manifest.interface.logoDark,
    ...(manifest.interface.screenshots ?? [])
  ].filter(Boolean) as string[]) {
    issues.push(...(await pluginPathIssues(root, manifestPath, asset, "plugin.asset", options)));
  }
  for (const screenshot of manifest.interface.screenshots ?? []) {
    const normalized = screenshot.replaceAll("\\", "/");
    if (!normalized.startsWith("./assets/") || path.extname(normalized).toLowerCase() !== ".png") {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "plugin.screenshot.invalid",
        message: `Screenshots must be PNG files under ./assets/: ${screenshot}`,
        file: manifestPath
      });
    }
  }
  const prompts = manifest.interface.defaultPrompt ?? manifest.interface.default_prompt;
  const promptList = (Array.isArray(prompts) ? prompts : [prompts]).filter(
    (prompt): prompt is string => typeof prompt === "string"
  );
  if (promptList.length > 3) {
    issues.push({
      level: "warning",
      impact: "advisory",
      code: "plugin.default-prompt.too-many",
      message: "Only the first three default prompts are used.",
      file: manifestPath
    });
  }
  if (promptList.some((prompt) => prompt.length > 128)) {
    issues.push({
      level: "warning",
      impact: "advisory",
      code: "plugin.default-prompt.long",
      message: "Default prompts longer than 128 characters are truncated.",
      file: manifestPath
    });
  }

  return issues;
}

async function pluginSkillsIssues(
  root: string,
  manifestPath: string,
  skills: string | undefined,
  options: LintOptions
): Promise<Issue[]> {
  const issues: Issue[] = [];
  if (!skills) return issues;
  const normalized = normalizeContractPath(skills);
  if (normalized !== "skills") {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "plugin.skills.contract-path",
      message: "Plugin skills must resolve to the conventional skills directory.",
      file: manifestPath
    });
    return issues;
  }
  for (const ref of [skills]) {
    issues.push(...(await contractPathIssues(root, manifestPath, ref, "plugin.skills", options)));
    const full = path.resolve(root, ref);
    if (!(await fs.pathExists(full))) continue;
    const stat = await fs.stat(full);
    if (!stat.isDirectory()) continue;
    const directSkill = await fs.pathExists(path.join(full, "SKILL.md"));
    const entries = await fs.readdir(full);
    const skillFolders = await Promise.all(
      entries.map(async (entry) =>
        (await fs.pathExists(path.join(full, entry, "SKILL.md"))) ? path.join(full, entry) : null
      )
    );
    if (!directSkill && !skillFolders.some(Boolean)) {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "plugin.skills.empty",
        message: `Skills path does not contain any SKILL.md files: ${ref}`,
        file: manifestPath
      });
    }
    if (directSkill) issues.push(...(await lintSkill(full, 500, options, root)));
    for (const skillFolder of skillFolders.filter(Boolean) as string[]) {
      issues.push(...(await lintSkill(skillFolder, 500, options, root)));
    }
  }
  return issues;
}

async function marketplaceMetadataIssues(
  root: string,
  manifestPath: string,
  manifest: PluginManifest,
  options: LintOptions
): Promise<Issue[]> {
  if (options.profile !== "marketplace") return [];
  const manifestCategory = manifest.interface?.category;
  if (!manifestCategory) return [];

  const categories = await marketplaceCategories(root, manifest);
  return Array.from(categories)
    .filter((category) => category !== manifestCategory)
    .map((category): Issue => ({
      level: "error",
      impact: "blocking",
      code: "plugin.category.mismatch",
      message: `Manifest category "${manifestCategory}" differs from marketplace metadata category "${category}".`,
      file: manifestPath
    }));
}

async function marketplaceCategories(root: string, manifest: PluginManifest): Promise<Set<string>> {
  const categories = new Set<string>();
  for (const repoRoot of await ancestorDirs(root)) {
    const marketplacePath = path.join(repoRoot, ".agents", "plugins", "marketplace.json");
    if (await fs.pathExists(marketplacePath)) {
      const raw = await readJsonSafe(marketplacePath);
      const plugins = Array.isArray((raw as { plugins?: unknown })?.plugins)
        ? (raw as { plugins: unknown[] }).plugins
        : [];
      for (const item of plugins) {
        const record = item as Record<string, unknown>;
        const source = record.source as Record<string, unknown> | undefined;
        const sourcePath = typeof source?.path === "string" ? source.path : undefined;
        if (sourcePath && samePath(path.resolve(repoRoot, sourcePath), root) && typeof record.category === "string") {
          categories.add(record.category);
        }
      }
    }

    const pluginsJsonPath = path.join(repoRoot, "plugins.json");
    if (await fs.pathExists(pluginsJsonPath)) {
      const raw = await readJsonSafe(pluginsJsonPath);
      const plugins = Array.isArray((raw as { plugins?: unknown })?.plugins)
        ? (raw as { plugins: unknown[] }).plugins
        : [];
      for (const item of plugins) {
        const record = item as Record<string, unknown>;
        const url = typeof record.url === "string" ? record.url : undefined;
        if (url && sameUrl(url, manifest.repository ?? manifest.homepage) && typeof record.category === "string") {
          categories.add(record.category);
        }
      }
    }
  }
  return categories;
}

async function readmeIssues(root: string, options: LintOptions): Promise<Issue[]> {
  if (options.profile !== "marketplace" && !options.strict) return [];
  const readmePath = path.join(root, "README.md");
  if (!(await fs.pathExists(readmePath))) return [];

  const content = await fs.readFile(readmePath, "utf8");
  const refs = readmeLocalPathRefs(content);
  const issues: Issue[] = [];
  for (const ref of refs) {
    const full = path.resolve(root, ref);
    if (!isInside(root, full) || !(await fs.pathExists(full))) {
      issues.push({
        level: "warning",
        impact: "advisory",
        code: "readme.local-path.missing",
        message: `README lists a local path that does not exist in the plugin bundle: ${ref}`,
        file: readmePath
      });
    }
  }
  return issues;
}

function readmeLocalPathRefs(content: string): string[] {
  const refs = new Set<string>();
  const roots = String.raw`(?:\.codex-plugin|\.claude-plugin|skills|scripts|references|assets|agents|commands|hooks|evals|examples)`;
  const backticks = new RegExp(String.raw`\`((?:\.{1,2}/)?${roots}(?:/[A-Za-z0-9._/-]*)?/?)\``, "g");
  for (const match of content.matchAll(backticks)) refs.add(match[1]);

  let inFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) continue;
    const match = line.match(
      new RegExp(String.raw`^\s*(?:[|` + "`" + String.raw`+\-]+\s*)?(${roots}(?:/[A-Za-z0-9._/-]*)?/?)\s{2,}`)
    );
    if (match) refs.add(match[1]);
  }

  return Array.from(refs).filter((ref) => !ref.includes("*") && !ref.includes("<") && !ref.includes(">"));
}

async function appManifestIssues(
  root: string,
  manifestPath: string,
  ref: string | undefined,
  options: LintOptions
): Promise<Issue[]> {
  if (!ref) return [];
  if (normalizeContractPath(ref) !== ".app.json") {
    return [
      {
        level: "error",
        impact: "blocking",
        code: "plugin.apps.contract-path",
        message: "Plugin apps must resolve to .app.json.",
        file: manifestPath
      }
    ];
  }
  const issues = await contractPathIssues(root, manifestPath, ref, "plugin.apps", options);
  const full = path.resolve(root, ref);
  if (!(await fs.pathExists(full))) return issues;
  const raw = await readJsonSafe(full);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "plugin.apps.invalid",
      message: ".app.json must contain a JSON object.",
      file: full
    });
    return issues;
  }
  const payload = raw as Record<string, unknown>;
  const unknownRootFields = Object.keys(payload).filter((key) => key !== "apps");
  if (unknownRootFields.length > 0) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "plugin.apps.unknown-field",
      message: `.app.json contains unsupported fields: ${unknownRootFields.join(", ")}`,
      file: full
    });
  }
  if (!payload.apps || typeof payload.apps !== "object" || Array.isArray(payload.apps)) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: "plugin.apps.invalid",
      message: ".app.json must contain an apps object.",
      file: full
    });
    return issues;
  }
  for (const [appName, app] of Object.entries(payload.apps as Record<string, unknown>)) {
    if (!app || typeof app !== "object" || Array.isArray(app)) {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "plugin.apps.entry-shape",
        message: `App "${appName}" must be an object.`,
        file: full
      });
      continue;
    }
    const record = app as Record<string, unknown>;
    const unknownFields = Object.keys(record).filter((key) => key !== "id" && key !== "category");
    if (unknownFields.length > 0) {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "plugin.apps.entry-unknown-field",
        message: `App "${appName}" contains unsupported fields: ${unknownFields.join(", ")}`,
        file: full
      });
    }
    if (typeof record.id !== "string" || !record.id.trim()) {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "plugin.apps.id-missing",
        message: `App "${appName}" must define a non-empty id.`,
        file: full
      });
    }
    if (record.category !== undefined && (typeof record.category !== "string" || !record.category.trim())) {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "plugin.apps.category-invalid",
        message: `App "${appName}" category must be a non-empty string when present.`,
        file: full
      });
    }
  }
  return issues;
}

async function mcpServersIssues(
  root: string,
  manifestPath: string,
  ref: PluginManifest["mcpServers"] | undefined,
  options: LintOptions
): Promise<Issue[]> {
  if (!ref) return [];
  if (typeof ref !== "string") {
    return validateMcpServerRecords(ref, manifestPath, root, options);
  }
  if (normalizeContractPath(ref) !== ".mcp.json") {
    return [
      {
        level: "error",
        impact: "blocking",
        code: "plugin.mcpServers.contract-path",
        message: "String-valued mcpServers must resolve to .mcp.json.",
        file: manifestPath
      }
    ];
  }
  const issues = await contractPathIssues(root, manifestPath, ref, "plugin.mcpServers", options);
  const full = path.resolve(root, ref);
  if (!(await fs.pathExists(full))) return issues;

  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(full, "utf8"));
  } catch (error) {
    return [
      ...issues,
      { level: "error", impact: "blocking", code: "plugin.mcpServers.invalid", message: String(error), file: full }
    ];
  }

  const servers = mcpServerRecords(raw, true);
  if (!servers) {
    return [
      ...issues,
      {
        level: "error",
        impact: "blocking",
        code: "plugin.mcpServers.shape",
        message: "MCP config should contain an mcpServers object or a server map.",
        file: full
      }
    ];
  }

  issues.push(...(await validateMcpServerRecords(servers, full, root, options)));
  return issues;
}

async function validateMcpServerRecords(
  servers: Record<string, unknown>,
  file: string,
  root: string,
  options: LintOptions
): Promise<Issue[]> {
  const issues: Issue[] = [];
  for (const [serverName, server] of Object.entries(servers)) {
    if (!server || typeof server !== "object" || Array.isArray(server)) {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "plugin.mcpServers.server-shape",
        message: `MCP server "${serverName}" must be an object.`,
        file
      });
      continue;
    }
    const record = server as Record<string, unknown>;
    const hasUrl = typeof record.url === "string";
    const command = record.command;
    if (!hasUrl && typeof command !== "string") {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "plugin.mcpServers.command-missing",
        message: `MCP server "${serverName}" should define a url or command.`,
        file
      });
    }
    if (typeof command === "string" && command.startsWith("./")) {
      issues.push(...(await pluginPathIssues(root, file, command, "plugin.mcpServers.command", options)));
    }
    const args = record.args;
    if (args !== undefined && (!Array.isArray(args) || !args.every((arg) => typeof arg === "string"))) {
      issues.push({
        level: "error",
        impact: "blocking",
        code: "plugin.mcpServers.args-shape",
        message: `MCP server "${serverName}" args must be an array of strings.`,
        file
      });
    }
    if (typeof record.cwd === "string" && record.cwd.startsWith("./")) {
      issues.push(...(await pluginPathIssues(root, file, record.cwd, "plugin.mcpServers.cwd", options)));
    }
  }

  return issues;
}

async function contractPathIssues(
  root: string,
  manifestPath: string,
  ref: string,
  code: string,
  options: LintOptions
): Promise<Issue[]> {
  const normalized = normalizeContractPath(ref);
  if (normalized === null) {
    return [
      {
        level: "error",
        impact: "blocking",
        code: `${code}.outside-root`,
        message: `Manifest path must stay inside the plugin root: ${ref}`,
        file: manifestPath
      }
    ];
  }
  return pluginPathIssues(root, manifestPath, ref.startsWith("./") ? ref : `./${ref}`, code, options);
}

function mcpServerRecords(raw: unknown, requireWrapper = false): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (requireWrapper && Object.keys(record).some((key) => key !== "mcpServers")) return null;
  const candidate = record.mcpServers;
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : null;
}

function containsTodoPlaceholder(value: unknown): boolean {
  if (typeof value === "string") return value.includes("[TODO:");
  if (Array.isArray(value)) return value.some(containsTodoPlaceholder);
  if (value && typeof value === "object") return Object.values(value).some(containsTodoPlaceholder);
  return false;
}

async function pluginPathIssues(
  root: string,
  manifestPath: string,
  ref: string,
  code: string,
  options: LintOptions
): Promise<Issue[]> {
  const issues: Issue[] = [];
  if (!ref.startsWith("./")) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: `${code}.relative`,
      message: `Manifest path must start with ./ and be relative to the plugin root: ${ref}`,
      file: manifestPath
    });
  }
  const full = path.resolve(root, ref);
  if (!isInside(root, full)) {
    issues.push({
      level: "error",
      impact: "blocking",
      code: `${code}.outside-root`,
      message: `Manifest path must stay inside the plugin root: ${ref}`,
      file: manifestPath
    });
  } else if (!(await fs.pathExists(full))) {
    if (options.profile === "source" && (await canBeBuilt(root, ref))) {
      issues.push({
        level: "warning",
        impact: "advisory",
        code: `${code}.build-missing`,
        message: `Manifest path does not exist yet but looks build-generated: ${ref}`,
        file: manifestPath
      });
    } else {
      issues.push({
        level: "error",
        impact: "blocking",
        code: `${code}.missing`,
        message: `Manifest path does not exist: ${ref}`,
        file: manifestPath
      });
    }
  }
  return issues;
}

async function canBeBuilt(root: string, ref: string): Promise<boolean> {
  const clean = ref.replaceAll("\\", "/");
  if (!clean.startsWith("./dist/") && !clean.startsWith("./build/") && !clean.startsWith("./out/")) return false;
  const packageJsonPath = path.join(root, "package.json");
  if (!(await fs.pathExists(packageJsonPath))) return false;
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as { scripts?: Record<string, unknown> };
    return typeof packageJson.scripts?.build === "string";
  } catch {
    return false;
  }
}

function normalizeContractPath(value: string): string | null {
  if (path.isAbsolute(value)) return null;
  const normalized = path.posix
    .normalize(value.replaceAll("\\", "/"))
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
  if (!normalized || normalized === ".." || normalized.startsWith("../")) return null;
  return normalized;
}

async function ancestorDirs(root: string): Promise<string[]> {
  const dirs: string[] = [];
  let current = path.resolve(root);
  while (true) {
    dirs.push(current);
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return dirs;
}

async function readJsonSafe(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function sameUrl(a: string, b: string | undefined): boolean {
  if (!b) return false;
  const normalize = (value: string) =>
    value
      .replace(/^git\+/, "")
      .replace(/\.git$/, "")
      .replace(/\/$/, "")
      .toLowerCase();
  return normalize(a) === normalize(b);
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
