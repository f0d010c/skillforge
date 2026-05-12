import path from "node:path";
import type { Issue, LintResult } from "../types.js";
import { toPosixPath } from "./paths.js";

export type ReportFormat = "text" | "json" | "sarif";

export function countErrors(issues: Issue[]): number {
  return issues.filter((issue) => issue.level === "error").length;
}

export function formatLintResult(result: LintResult, format: ReportFormat): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }
  if (format === "sarif") {
    return JSON.stringify(toSarif(result), null, 2);
  }
  return toText(result);
}

function toText(result: LintResult): string {
  if (result.issues.length === 0) {
    const checked = result.checkedPaths?.length ? ` (${result.checkedPaths.length} target(s) checked)` : "";
    const profile = result.profile ? ` [${result.profile}]` : "";
    return `SkillForge ${result.kind} lint passed${profile}: ${result.targetPath}${checked}`;
  }

  const checked = result.checkedPaths?.length ? ` across ${result.checkedPaths.length} target(s)` : "";
  const profile = result.profile ? ` [${result.profile}]` : "";
  const blockers = result.issues.filter((issue) => issue.impact === "blocking").length;
  const advisories = result.issues.filter((issue) => issue.impact === "advisory").length;
  const summary = blockers || advisories ? ` (${blockers} blocking, ${advisories} advisory)` : "";
  const lines = [`SkillForge ${result.kind} lint found ${result.issues.length} issue(s)${summary}${checked}${profile}:`];
  for (const issue of result.issues) {
    const location = issue.file ? ` ${issue.file}` : "";
    const impact = issue.impact ? ` ${issue.impact}` : "";
    lines.push(`[${issue.level.toUpperCase()}${impact}] ${issue.code}${location} - ${issue.message}`);
  }
  return lines.join("\n");
}

function toSarif(result: LintResult): unknown {
  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "codex-skillforge",
            informationUri: "https://github.com/f0d010c/skillforge",
            rules: uniqueRules(result.issues)
          }
        },
        results: result.issues.map((issue) => ({
          ruleId: issue.code,
          level: issue.level === "error" ? "error" : "warning",
          message: { text: issue.impact ? `${issue.message} (${issue.impact})` : issue.message },
          locations: issue.file
            ? [
                {
                  physicalLocation: {
                    artifactLocation: {
                      uri: toPosixPath(path.relative(result.targetPath, issue.file))
                    }
                  }
                }
              ]
            : []
        }))
      }
    ]
  };
}

function uniqueRules(issues: Issue[]) {
  return Array.from(new Set(issues.map((issue) => issue.code))).map((code) => ({
    id: code,
    shortDescription: { text: code }
  }));
}
