import path from "node:path";
import fs from "fs-extra";
import { z } from "zod";
import type { SkillForgeConfig } from "../types.js";

const configSchema = z.object({
  name: z.string().optional(),
  type: z.enum(["skill", "plugin"]).optional(),
  examples: z
    .array(
      z.object({
        prompt: z.string(),
        shouldTrigger: z.boolean()
      })
    )
    .optional(),
  checks: z
    .object({
      maxSkillMdLines: z.number().int().positive().optional(),
      requireOpenAiYaml: z.boolean().optional(),
      allowScripts: z.boolean().optional()
    })
    .optional(),
  lint: z
    .object({
      ignore: z.array(z.string().min(1)).optional(),
      allowEmptyCollection: z.boolean().optional()
    })
    .optional()
});

export async function loadConfig(targetPath: string): Promise<SkillForgeConfig> {
  const configPath = path.join(targetPath, "skillforge.json");
  if (!(await fs.pathExists(configPath))) {
    return {};
  }

  const parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
  return configSchema.parse(parsed);
}
