import { describe, expect, it } from "vitest";
import { lintPath } from "../src/lib/lint.js";
import { formatLintResult } from "../src/lib/reporters.js";

const fixture = (name: string) => `tests/fixtures/${name}`;

describe("lintPath", () => {
  it("passes a valid instruction-only skill", async () => {
    const result = await lintPath(fixture("valid-skill"));
    expect(result.kind).toBe("skill");
    expect(result.issues.filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("passes a scripted skill with an existing referenced script", async () => {
    const result = await lintPath(fixture("scripted-skill"));
    expect(result.issues.filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("fails when SKILL.md is missing", async () => {
    const result = await lintPath(fixture("missing-skill-md"));
    expect(result.issues.map((issue) => issue.code)).toContain("shape.unknown");
  });

  it("fails invalid frontmatter", async () => {
    const result = await lintPath(fixture("invalid-frontmatter"));
    expect(result.issues.map((issue) => issue.code)).toContain("skill.frontmatter.missing");
  });

  it("warns on vague descriptions", async () => {
    const result = await lintPath(fixture("vague-skill"));
    expect(result.issues.map((issue) => issue.code)).toContain("skill.description.vague");
  });

  it("fails broken references", async () => {
    const result = await lintPath(fixture("broken-reference"));
    expect(result.issues.map((issue) => issue.code)).toContain("reference.missing");
  });

  it("passes a valid plugin", async () => {
    const result = await lintPath(fixture("valid-plugin"));
    expect(result.kind).toBe("plugin");
    expect(result.issues.filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("lints a repository-style collection recursively", async () => {
    const result = await lintPath(fixture("collection"));
    expect(result.kind).toBe("collection");
    expect(result.checkedPaths?.length).toBe(2);
    expect(result.issues.filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("fails plugin name mismatch", async () => {
    const result = await lintPath(fixture("plugin-name-mismatch"));
    expect(result.issues.map((issue) => issue.code)).toContain("plugin.name.mismatch");
  });

  it("fails legacy top-level openai yaml metadata", async () => {
    const result = await lintPath(fixture("legacy-openai-yaml"));
    expect(result.issues.map((issue) => issue.code)).toContain("metadata.openai-yaml.legacy-shape");
  });

  it("emits JSON and SARIF output", async () => {
    const result = await lintPath(fixture("valid-skill"));
    expect(() => JSON.parse(formatLintResult(result, "json"))).not.toThrow();
    const sarif = JSON.parse(formatLintResult(result, "sarif"));
    expect(sarif.version).toBe("2.1.0");
  });
});
