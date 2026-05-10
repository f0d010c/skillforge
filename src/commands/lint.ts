import { lintPath } from "../lib/lint.js";
import { countErrors, formatLintResult, type ReportFormat } from "../lib/reporters.js";

export async function lintCommand(targetPath: string, format: ReportFormat, options: { strict?: boolean } = {}): Promise<{ output: string; exitCode: number }> {
  const result = await lintPath(targetPath, { strict: options.strict });
  return {
    output: formatLintResult(result, format),
    exitCode: countErrors(result.issues) > 0 ? 1 : 0
  };
}
