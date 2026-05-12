import { describe, expect, it } from "vitest";
import { compatCommand } from "../src/commands/compat.js";
import { lintPath } from "../src/lib/lint.js";
import { formatLintResult } from "../src/lib/reporters.js";

const fixture = (name: string) => `tests/fixtures/${name}`;
const realWorldCase = (name: string) => `examples/real-world-cases/${name}`;

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
    const result = await lintPath(fixture("vague-skill"), { strict: true });
    expect(result.issues.map((issue) => issue.code)).toContain("skill.description.vague");
  });

  it("keeps advisory description warnings out of default mode", async () => {
    const result = await lintPath(fixture("vague-skill"));
    expect(result.issues.map((issue) => issue.code)).not.toContain("skill.description.vague");
  });

  it("fails broken references", async () => {
    const result = await lintPath(fixture("broken-reference"));
    expect(result.issues.map((issue) => issue.code)).toContain("reference.missing");
  });

  it("does not treat placeholder words or external URLs as missing references", async () => {
    const result = await lintPath(fixture("reference-noise"));
    expect(result.issues.map((issue) => issue.code)).not.toContain("reference.missing");
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
    const result = await lintPath(fixture("plugin-name-mismatch"), { strict: true });
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

  it("marks build-generated MCP commands as advisory in source profile", async () => {
    const result = await lintPath(fixture("build-output-plugin"), { profile: "source" });
    const issue = result.issues.find((item) => item.code === "plugin.mcpServers.command.build-missing");
    expect(issue?.level).toBe("warning");
    expect(issue?.impact).toBe("advisory");
    expect(result.issues.filter((item) => item.level === "error")).toEqual([]);
  });

  it("marks missing build-generated MCP commands as blocking in marketplace profile", async () => {
    const result = await lintPath(fixture("build-output-plugin"), { profile: "marketplace" });
    const issue = result.issues.find((item) => item.code === "plugin.mcpServers.command.missing");
    expect(issue?.level).toBe("error");
    expect(issue?.impact).toBe("blocking");
  });

  it("validates MCP server command and args shape", async () => {
    const result = await lintPath(fixture("invalid-mcp-plugin"));
    expect(result.issues.map((issue) => issue.code)).toContain("plugin.mcpServers.command-missing");
    expect(result.issues.map((issue) => issue.code)).toContain("plugin.mcpServers.args-shape");
  });

  it("prints impact labels instead of confidence labels", async () => {
    const result = await lintPath(fixture("build-output-plugin"), { profile: "source" });
    const output = formatLintResult(result, "text");
    expect(output).toContain("[WARNING advisory]");
    expect(output).not.toContain("confidence");
  });

  it("documents a real-world missing MCP server file case", async () => {
    const result = await lintPath(realWorldCase("missing-mcp-server-file"));
    expect(result.issues.map((issue) => issue.code)).toContain("plugin.mcpServers.missing");
  });

  it("documents a real-world stale skill reference case", async () => {
    const result = await lintPath(realWorldCase("stale-skill-reference"));
    expect(result.issues.map((issue) => issue.code)).toContain("reference.missing");
  });

  it("documents a real-world weak trigger description case", async () => {
    const result = await lintPath(realWorldCase("weak-trigger-description"), { strict: true });
    expect(result.issues.map((issue) => issue.code)).toContain("skill.description.vague");
  });

  it("checks portable compatibility wording", async () => {
    const result = await compatCommand(fixture("portable-wording-skill"), "portable", "json");
    const parsed = JSON.parse(result.output);
    expect(parsed.issues.map((issue: { code: string }) => issue.code)).toContain("portable.wording.claude");
    expect(parsed.issues.map((issue: { code: string }) => issue.code)).toContain("portable.wording.codex");
    expect(parsed.issues.map((issue: { code: string }) => issue.code)).toContain("portable.path.claude");
    expect(parsed.issues.map((issue: { code: string }) => issue.code)).toContain("portable.path.codex");
  });

  it("checks portable script coverage", async () => {
    const result = await compatCommand(fixture("unix-only-skill"), "portable", "json");
    const parsed = JSON.parse(result.output);
    expect(parsed.issues.map((issue: { code: string }) => issue.code)).toContain("portable.scripts.unix-only");
  });
});
