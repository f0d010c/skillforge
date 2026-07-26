import { z } from "zod";

export const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const nonempty = z.string().trim().min(1);
const httpsUrl = nonempty.refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "must be an absolute https:// URL");
const assetPath = nonempty;

const pluginInterfaceSchema = z
  .object({
    displayName: nonempty,
    shortDescription: nonempty,
    longDescription: nonempty,
    developerName: nonempty,
    category: nonempty,
    capabilities: z.array(nonempty),
    websiteURL: httpsUrl.optional(),
    privacyPolicyURL: httpsUrl.optional(),
    termsOfServiceURL: httpsUrl.optional(),
    brandColor: z
      .string()
      .regex(/^#[0-9A-F]{6}$/i, "must use #RRGGBB")
      .optional(),
    composerIcon: assetPath.optional(),
    logo: assetPath.optional(),
    logoDark: assetPath.optional(),
    screenshots: z.array(assetPath).optional(),
    defaultPrompt: z.union([nonempty, z.array(nonempty)]).optional(),
    default_prompt: z.union([nonempty, z.array(nonempty)]).optional()
  })
  .strict()
  .refine((value) => value.defaultPrompt !== undefined || value.default_prompt !== undefined, {
    message: "defaultPrompt or default_prompt is required"
  });

const mcpServerSchema = z.record(z.string(), z.unknown());

export const pluginManifestSchema = z
  .object({
    id: nonempty.optional(),
    name: nonempty,
    version: nonempty.regex(semverPattern, "must be strict semver"),
    description: nonempty,
    author: z
      .object({
        name: nonempty,
        email: nonempty.optional(),
        url: httpsUrl.optional()
      })
      .strict(),
    homepage: nonempty.optional(),
    repository: nonempty.optional(),
    license: nonempty.optional(),
    keywords: z.array(nonempty).optional(),
    skills: nonempty.optional(),
    apps: nonempty.optional(),
    mcpServers: z.union([nonempty, z.record(z.string(), mcpServerSchema)]).optional(),
    interface: pluginInterfaceSchema
  })
  .strict();

const dependencyToolSchema = z
  .object({
    type: z.literal("mcp"),
    value: nonempty,
    description: nonempty.optional(),
    transport: nonempty.optional(),
    url: httpsUrl.optional()
  })
  .strict();

export const openAiYamlSchema = z
  .object({
    interface: z
      .object({
        display_name: nonempty,
        short_description: nonempty,
        icon_small: assetPath.optional(),
        icon_large: assetPath.optional(),
        brand_color: z
          .string()
          .regex(/^#[0-9A-F]{6}$/i, "must use #RRGGBB")
          .optional(),
        default_prompt: nonempty.optional()
      })
      .strict(),
    policy: z
      .object({
        allow_implicit_invocation: z.boolean().optional()
      })
      .strict()
      .optional(),
    dependencies: z
      .object({
        tools: z.array(dependencyToolSchema)
      })
      .strict()
      .optional()
  })
  .strict();

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
