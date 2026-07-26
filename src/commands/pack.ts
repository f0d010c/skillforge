import path from "node:path";
import fs from "fs-extra";
import type { Archiver, ArchiverOptions } from "archiver";
import { lintPath } from "../lib/lint.js";
import { packageFiles } from "../lib/package-files.js";
import { parseMarkdownFrontmatter } from "../lib/frontmatter.js";
import { countErrors } from "../lib/reporters.js";

interface PackOptions {
  outDir?: string;
  skipLint?: boolean;
}

export async function packCommand(targetPath: string, options: PackOptions): Promise<string> {
  const source = path.resolve(targetPath);
  const result = await lintPath(source, { profile: "marketplace" });
  if (!options.skipLint && countErrors(result.issues) > 0) {
    throw new Error("Refusing to pack while lint errors exist. Re-run with --skip-lint to override.");
  }
  if (result.kind !== "skill" && result.kind !== "plugin") {
    throw new Error("Pack expects one skill or plugin root, not a repository collection.");
  }

  const outDir = path.resolve(options.outDir ?? path.join(source, "dist"));
  const name = await packageName(source, result.kind);
  const files = await packageFiles(source, outDir);
  assertRequiredEntries(files, result.kind);

  await fs.ensureDir(outDir);
  const zipPath = path.join(outDir, `${name}.zip`);
  await writeArchive(source, zipPath, files);
  await fs.writeFile(path.join(outDir, "INSTALL.md"), installSnippet(name, result.kind), "utf8");
  if (result.kind === "plugin") {
    await fs.writeJson(path.join(outDir, "marketplace-entry.json"), marketplaceEntry(name), { spaces: 2 });
  }
  return `Packed ${source}\nZip: ${zipPath}\nFiles: ${files.length}\nInstall notes: ${path.join(outDir, "INSTALL.md")}`;
}

async function packageName(source: string, kind: "skill" | "plugin"): Promise<string> {
  if (kind === "plugin") {
    const manifest = await fs.readJson(path.join(source, ".codex-plugin", "plugin.json"));
    return String(manifest.name);
  }
  const parsed = parseMarkdownFrontmatter(await fs.readFile(path.join(source, "SKILL.md"), "utf8"));
  return String(parsed?.data.name ?? path.basename(source));
}

function assertRequiredEntries(files: string[], kind: "skill" | "plugin"): void {
  const required = kind === "plugin" ? ".codex-plugin/plugin.json" : "SKILL.md";
  if (!files.includes(required)) {
    throw new Error(`Package policy omitted required entry: ${required}`);
  }
}

async function writeArchive(source: string, zipPath: string, files: string[]): Promise<void> {
  await fs.remove(zipPath);
  const stableDate = new Date("1980-01-01T00:00:00.000Z");
  const { ZipArchive } = (await import("archiver")) as unknown as {
    ZipArchive: new (options?: ArchiverOptions) => Archiver;
  };
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    for (const relative of files) {
      archive.append(fs.createReadStream(path.join(source, relative)), {
        name: relative,
        date: stableDate,
        mode: 0o100644
      });
    }
    void archive.finalize().catch(reject);
  });
}

function installSnippet(name: string, kind: "skill" | "plugin"): string {
  if (kind === "skill") {
    return `# Install ${name}\n\nCopy this folder into \`$CODEX_HOME/skills/${name}\`. When \`CODEX_HOME\` is unset, use \`~/.codex/skills/${name}\`. Restart Codex if the skill does not appear.\n`;
  }
  return `# Install ${name}\n\nCopy this folder under a marketplace plugin root such as \`./plugins/${name}\`, add the generated \`marketplace-entry.json\` object to the marketplace's \`plugins\` array, and reinstall the plugin.\n`;
}

function marketplaceEntry(name: string): unknown {
  return {
    name,
    source: {
      source: "local",
      path: `./plugins/${name}`
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL"
    },
    category: "Productivity"
  };
}
