import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

export async function doctorCommand(targetPath = "."): Promise<{ output: string; exitCode: number }> {
  const cwd = path.resolve(targetPath);
  const codexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(os.homedir(), ".codex");
  const agentsHome = path.join(os.homedir(), ".agents");
  const lines = ["SkillForge doctor", ""];
  let warnings = 0;

  warnings += await addPath(lines, "Target", cwd, true);
  warnings += await addPath(lines, "Codex home", codexHome, true);
  warnings += await addPath(lines, "Codex user skills", path.join(codexHome, "skills"), true);
  await addPath(lines, "Legacy user skills", path.join(agentsHome, "skills"));
  await addPath(lines, "Repo skills", path.join(cwd, ".agents", "skills"));
  await addPath(lines, "Plugin cache", path.join(codexHome, "plugins", "cache"));
  await addPath(lines, "Personal marketplace", path.join(agentsHome, "plugins", "marketplace.json"));
  await addPath(lines, "Repo marketplace", path.join(cwd, ".agents", "plugins", "marketplace.json"));

  const configPath = path.join(codexHome, "config.toml");
  if (await fs.pathExists(configPath)) {
    lines.push(`OK   config.toml: ${configPath}`);
  } else {
    warnings += 1;
    lines.push(`WARN config.toml: not found at ${configPath}`);
  }

  return { output: lines.join("\n"), exitCode: warnings > 0 ? 1 : 0 };
}

async function addPath(lines: string[], label: string, value: string, required = false): Promise<number> {
  const exists = await fs.pathExists(value);
  lines.push(`${exists ? "OK  " : "MISS"} ${label}: ${value}`);
  return required && !exists ? 1 : 0;
}
