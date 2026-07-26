import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { doctorCommand } from "../src/commands/doctor.js";
import { smokeCommand } from "../src/commands/smoke.js";
import { loadConfig } from "../src/lib/config.js";
import { parseMarkdownFrontmatter } from "../src/lib/frontmatter.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((directory) => fs.remove(directory)));
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(directory);
  return directory;
}

describe("commands and parsing", () => {
  it("parses real YAML frontmatter including folded descriptions", () => {
    const parsed = parseMarkdownFrontmatter(
      "---\nname: sample-skill\ndescription: >-\n  Use this skill for a focused\n  multi-line workflow.\n---\n\n# Sample\n"
    );
    expect(parsed?.data.description).toBe("Use this skill for a focused multi-line workflow.");
  });

  it("rejects missing and malformed YAML frontmatter", () => {
    expect(parseMarkdownFrontmatter("# No frontmatter")).toBeNull();
    expect(parseMarkdownFrontmatter("---\nname: [broken\n---\n")).toBeNull();
  });

  it("rejects unknown configuration keys instead of silently ignoring typos", async () => {
    const root = await temporaryDirectory("skillforge-config-");
    await fs.writeJson(path.join(root, "skillforge.json"), { chekcs: { maxSkillMdLines: 1 } });
    await expect(loadConfig(root)).rejects.toThrow();
  });

  it("checks the active CODEX_HOME skill directory", async () => {
    const root = await temporaryDirectory("skillforge-doctor-");
    const codexHome = path.join(root, "codex");
    await fs.ensureDir(path.join(codexHome, "skills"));
    await fs.writeFile(path.join(codexHome, "config.toml"), "");
    const previous = process.env.CODEX_HOME;
    process.env.CODEX_HOME = codexHome;
    try {
      const result = await doctorCommand(root);
      expect(result.output).toContain(`Codex user skills: ${path.join(codexHome, "skills")}`);
      expect(result.exitCode).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previous;
    }
  });

  it("returns a nonzero doctor result when required Codex paths are absent", async () => {
    const root = await temporaryDirectory("skillforge-doctor-missing-");
    const previous = process.env.CODEX_HOME;
    process.env.CODEX_HOME = path.join(root, "missing-codex-home");
    try {
      const result = await doctorCommand(root);
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("MISS Codex home");
    } finally {
      if (previous === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previous;
    }
  });

  it("can require the expected skill in static smoke examples", async () => {
    const root = await temporaryDirectory("skillforge-smoke-");
    for (const [name, description] of [
      ["web-design", "Use for React websites, web dashboards, and landing pages."],
      ["android-design", "Use for Android apps, Jetpack Compose, and Material interfaces."]
    ]) {
      const skillRoot = path.join(root, "skills", name);
      await fs.ensureDir(skillRoot);
      await fs.writeFile(
        path.join(skillRoot, "SKILL.md"),
        `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`
      );
    }
    await fs.writeJson(path.join(root, "skillforge.json"), {
      lint: { allowEmptyCollection: false },
      examples: [
        {
          prompt: "Build an Android interface with Jetpack Compose",
          shouldTrigger: true,
          expectedSkill: "android-design"
        }
      ]
    });
    const result = await smokeCommand(root);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("expected android-design");
  });

  it("fails static smoke when another skill wins", async () => {
    const root = await temporaryDirectory("skillforge-smoke-fail-");
    const skillRoot = path.join(root, "skills", "web-design");
    await fs.ensureDir(skillRoot);
    await fs.writeFile(
      path.join(skillRoot, "SKILL.md"),
      "---\nname: web-design\ndescription: Use for React websites and web dashboards.\n---\n"
    );
    await fs.writeJson(path.join(root, "skillforge.json"), {
      examples: [
        {
          prompt: "Build a React web dashboard",
          shouldTrigger: true,
          expectedSkill: "android-design"
        }
      ]
    });
    const result = await smokeCommand(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("FAIL example 1");
  });
});
