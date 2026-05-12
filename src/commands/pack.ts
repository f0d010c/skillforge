import path from "node:path";
import fs from "fs-extra";
import type archiver from "archiver";
import { lintPath } from "../lib/lint.js";
import { countErrors } from "../lib/reporters.js";

interface PackOptions {
  outDir?: string;
  skipLint?: boolean;
}

export async function packCommand(targetPath: string, options: PackOptions): Promise<string> {
  const source = path.resolve(targetPath);
  if (!options.skipLint) {
    const result = await lintPath(source);
    if (countErrors(result.issues) > 0) {
      throw new Error("Refusing to pack while lint errors exist. Re-run with --skip-lint to override.");
    }
  }

  const outDir = path.resolve(options.outDir ?? path.join(source, "dist"));
  await fs.ensureDir(outDir);
  const name = path.basename(source);
  const zipPath = path.join(outDir, `${name}.zip`);
  await zipDirectory(source, zipPath, outDir);
  await fs.writeFile(path.join(outDir, "INSTALL.md"), installSnippet(name), "utf8");
  await fs.writeJson(path.join(outDir, "marketplace-entry.json"), marketplaceEntry(name), { spaces: 2 });
  return `Packed ${source}\nZip: ${zipPath}\nInstall notes: ${path.join(outDir, "INSTALL.md")}`;
}

async function zipDirectory(source: string, zipPath: string, outDir: string): Promise<void> {
  const { ZipArchive } = (await import("archiver")) as unknown as {
    ZipArchive: new (options?: archiver.ArchiverOptions) => archiver.Archiver;
  };
  await fs.remove(zipPath);
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.glob("**/*", {
      cwd: source,
      ignore: ["node_modules/**", "dist/**", path.relative(source, outDir).replaceAll("\\", "/") + "/**"]
    });
    archive.finalize().catch(reject);
  });
}

function installSnippet(name: string): string {
  return `# Install ${name}\n\nFor a skill, copy this folder into \`$HOME/.agents/skills/${name}\` or a repo-local \`.agents/skills/${name}\`, then restart Codex if it does not appear.\n\nFor a plugin, copy the folder under a marketplace root such as \`./plugins/${name}\` and add the generated \`marketplace-entry.json\` object to \`.agents/plugins/marketplace.json\`.\n`;
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
