import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { initCommand } from "../src/commands/init.js";
import { packCommand } from "../src/commands/pack.js";
import { packageFiles } from "../src/lib/package-files.js";
import { lintPath } from "../src/lib/lint.js";

const temporaryRoots: string[] = [];
const fixture = (name: string) => path.resolve(`tests/fixtures/${name}`);

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((directory) => fs.remove(directory)));
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(directory);
  return directory;
}

describe("pack", () => {
  it("includes the hidden plugin manifest and excludes repository-only files", async () => {
    const files = await packageFiles(fixture("valid-plugin"));
    expect(files).toContain(".codex-plugin/plugin.json");
    expect(files).toContain("skills/example/SKILL.md");
    expect(files.some((file) => file.startsWith("tests/"))).toBe(false);
    expect(files.some((file) => file.startsWith(".git/"))).toBe(false);
  });

  it("writes deterministic plugin archives with required entries", async () => {
    const first = await temporaryDirectory("skillforge-pack-first-");
    const second = await temporaryDirectory("skillforge-pack-second-");
    await packCommand(fixture("valid-plugin"), { outDir: first });
    await packCommand(fixture("valid-plugin"), { outDir: second });

    const firstZip = await fs.readFile(path.join(first, "valid-plugin.zip"));
    const secondZip = await fs.readFile(path.join(second, "valid-plugin.zip"));
    expect(createHash("sha256").update(firstZip).digest("hex")).toBe(
      createHash("sha256").update(secondZip).digest("hex")
    );
    expect(zipEntryNames(firstZip)).toContain(".codex-plugin/plugin.json");
    expect(await fs.pathExists(path.join(first, "marketplace-entry.json"))).toBe(true);
  });

  it("generates a current-contract plugin template that lints cleanly", async () => {
    const root = await temporaryDirectory("skillforge-init-plugin-");
    const destination = path.join(root, "sample-plugin");
    await initCommand("plugin", destination, {
      name: "sample-plugin",
      author: "Example Author"
    });
    const result = await lintPath(destination, { profile: "marketplace", strict: true });
    expect(result.issues.filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("packs skills without generating plugin marketplace metadata", async () => {
    const root = await temporaryDirectory("skillforge-init-skill-");
    const destination = path.join(root, "sample-skill");
    const output = path.join(root, "output");
    await initCommand("skill", destination, { name: "sample-skill" });
    await packCommand(destination, { outDir: output });
    const archive = await fs.readFile(path.join(output, "sample-skill.zip"));
    expect(zipEntryNames(archive)).toContain("SKILL.md");
    expect(await fs.pathExists(path.join(output, "marketplace-entry.json"))).toBe(false);
  });

  it("refuses to pack repository collections", async () => {
    const output = await temporaryDirectory("skillforge-pack-collection-");
    await expect(packCommand(path.resolve("."), { outDir: output })).rejects.toThrow(
      "Pack expects one skill or plugin root"
    );
  });
});

function zipEntryNames(buffer: Buffer): string[] {
  const names: string[] = [];
  for (let offset = 0; offset <= buffer.length - 46; offset += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    names.push(buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8"));
    offset += 45 + fileNameLength + extraLength + commentLength;
  }
  return names;
}
