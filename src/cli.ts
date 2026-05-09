#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import { initCommand, type InitKind } from "./commands/init.js";
import { lintCommand } from "./commands/lint.js";
import { doctorCommand } from "./commands/doctor.js";
import { packCommand } from "./commands/pack.js";
import { smokeCommand } from "./commands/smoke.js";
import type { ReportFormat } from "./lib/reporters.js";

const program = new Command();

program
  .name("codex-skillforge")
  .description("Creator tooling for OpenAI Codex skills and plugins.")
  .version("0.1.0")
  .exitOverride();

program
  .command("init")
  .argument("<kind>", "skill or plugin", parseKind)
  .argument("[path]", "output path", ".")
  .option("-n, --name <name>", "skill/plugin name")
  .option("-t, --template <template>", "template name")
  .option("--force", "merge into a non-empty destination")
  .action(async (kind: InitKind, outputPath: string, options) => {
    console.log(await initCommand(kind, outputPath, options));
  });

program
  .command("lint")
  .argument("[path]", "skill or plugin path", ".")
  .option("-f, --format <format>", "text, json, or sarif", parseFormat, "text")
  .action(async (targetPath: string, options: { format: ReportFormat }) => {
    const result = await lintCommand(targetPath, options.format);
    console.log(result.output);
    process.exitCode = result.exitCode;
  });

program
  .command("doctor")
  .argument("[path]", "path to inspect", ".")
  .action(async (targetPath: string) => {
    const result = await doctorCommand(targetPath);
    console.log(result.output);
    process.exitCode = result.exitCode;
  });

program
  .command("pack")
  .argument("[path]", "skill or plugin path", ".")
  .option("-o, --out-dir <path>", "output directory")
  .option("--skip-lint", "pack even if lint errors exist")
  .action(async (targetPath: string, options) => {
    console.log(await packCommand(targetPath, options));
  });

program
  .command("smoke")
  .argument("[path]", "skill or plugin path", ".")
  .action(async (targetPath: string) => {
    const result = await smokeCommand(targetPath);
    console.log(result.output);
    process.exitCode = result.exitCode;
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof Error && "exitCode" in error) {
    process.exitCode = Number((error as { exitCode: number }).exitCode);
    if (process.exitCode !== 0) {
      console.error(error.message);
    }
  } else {
    process.exitCode = 2;
    console.error(error instanceof Error ? error.message : String(error));
  }
}

function parseKind(value: string): InitKind {
  if (value === "skill" || value === "plugin") {
    return value;
  }
  throw new InvalidArgumentError("kind must be 'skill' or 'plugin'");
}

function parseFormat(value: string): ReportFormat {
  if (value === "text" || value === "json" || value === "sarif") {
    return value;
  }
  throw new InvalidArgumentError("format must be 'text', 'json', or 'sarif'");
}
