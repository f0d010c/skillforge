import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

export async function doctorCommand(targetPath = "."): Promise<{ output: string; exitCode: number }> {
  const cwd = path.resolve(targetPath);
  const codexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(os.homedir(), ".codex");
  const agentsHome = path.join(os.homedir(), ".agents");
  const lines = ["Codex SkillForge doctor", ""];
  let warnings = 0;

  await addPath(lines, "Target", cwd);
  await addPath(lines, "Codex home", codexHome);
  await addPath(lines, "User skills", path.join(agentsHome, "skills"));
  await addPath(lines, "Repo skills", path.join(cwd, ".agents", "skills"));
  await addPath(lines, "Plugin cache", path.join(codexHome, "plugins", "cache"));
  await addPath(lines, "Agents marketplace", path.join(agentsHome, "plugins", "marketplace.json"));
  await addPath(lines, "Repo marketplace", path.join(cwd, ".agents", "plugins", "marketplace.json"));

  const configPath = path.join(codexHome, "config.toml");
  if (await fs.pathExists(configPath)) {
    lines.push(`OK   config.toml: ${configPath}`);
    const config = await fs.readFile(configPath, "utf8");
    if (!/codex_hooks\s*=\s*true/.test(config)) {
      warnings += 1;
      lines.push("WARN hooks: codex_hooks feature flag was not found in config.toml");
    }
  } else {
    warnings += 1;
    lines.push(`WARN config.toml: not found at ${configPath}`);
  }

  return { output: lines.join("\n"), exitCode: warnings > 0 ? 1 : 0 };
}

async function addPath(lines: string[], label: string, value: string): Promise<void> {
  const exists = await fs.pathExists(value);
  lines.push(`${exists ? "OK  " : "MISS"} ${label}: ${value}`);
}
