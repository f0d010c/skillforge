import path from "node:path";
import fs from "fs-extra";
import { hyphenName, resolveTemplateRoot } from "../lib/paths.js";

export type InitKind = "skill" | "plugin";

interface InitOptions {
  name?: string;
  template?: string;
  force?: boolean;
}

export async function initCommand(kind: InitKind, outputPath: string, options: InitOptions): Promise<string> {
  const name = hyphenName(options.name ?? path.basename(path.resolve(outputPath)));
  if (!name) {
    throw new Error("A valid name is required.");
  }

  const templateName = options.template ?? defaultTemplate(kind);
  const source = path.join(resolveTemplateRoot(), templateName);
  const destination = path.resolve(outputPath);

  if (!(await fs.pathExists(source))) {
    throw new Error(`Unknown template: ${templateName}`);
  }
  if ((await fs.pathExists(destination)) && !options.force && (await fs.readdir(destination)).length > 0) {
    throw new Error(`Destination is not empty: ${destination}. Pass --force to merge template files.`);
  }

  await fs.ensureDir(destination);
  await fs.copy(source, destination, { overwrite: Boolean(options.force), errorOnExist: !options.force });
  await replaceTokens(destination, {
    "__SKILLFORGE_NAME__": name,
    "__SKILLFORGE_TITLE__": titleCase(name)
  });

  return `Created ${kind} "${name}" at ${destination}`;
}

function defaultTemplate(kind: InitKind): string {
  return kind === "skill" ? "skill-basic" : "plugin-with-skill";
}

async function replaceTokens(root: string, replacements: Record<string, string>): Promise<void> {
  const entries = await fs.readdir(root);
  for (const entry of entries) {
    const full = path.join(root, entry);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      await replaceTokens(full, replacements);
      continue;
    }
    const text = await fs.readFile(full, "utf8");
    const next = Object.entries(replacements).reduce((acc, [from, to]) => acc.replaceAll(from, to), text);
    await fs.writeFile(full, next);
  }
}

function titleCase(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
