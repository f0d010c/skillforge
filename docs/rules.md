# Rule guide

SkillForge reports stable rule codes with a level and impact.

- `error blocking`: invalid contract, unsafe or unusable package, missing required file, or failed explicit expectation.
- `warning advisory`: maintainability, clarity, portability, or future-readiness concern.

## Core rule families

| Prefix                   | Scope                                  | Typical remediation                                               |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------------- |
| `skill.frontmatter.*`    | `SKILL.md` YAML and required fields    | Use valid YAML with nonempty `name` and `description`             |
| `skill.name.*`           | Skill identity                         | Use lowercase hyphen-case and match the folder                    |
| `skill.description.*`    | Trigger quality                        | Front-load a concise “use when” description                       |
| `reference.*`            | Local Markdown and resource paths      | Correct or remove stale references                                |
| `metadata.openai-yaml.*` | `agents/openai.yaml`                   | Use current nested interface, policy, and dependency fields       |
| `plugin.manifest.*`      | `.codex-plugin/plugin.json`            | Remove unknown fields and supply current required metadata        |
| `plugin.skills.*`        | Conventional skills directory          | Use `./skills/` and include valid child skills                    |
| `plugin.mcpServers.*`    | Inline or `.mcp.json` MCP declarations | Use the current shape and valid command, URL, args, and paths     |
| `plugin.apps.*`          | `.app.json` declaration                | Use the conventional companion file and an `apps` object          |
| `plugin.asset.*`         | Logos, icons, and screenshots          | Keep paths inside the plugin and ship the referenced files        |
| `plugin.category.*`      | Marketplace metadata                   | Keep plugin and marketplace categories consistent                 |
| `readme.local-path.*`    | Documented local paths                 | Update stale file-tree or path documentation                      |
| `portable.*`             | Cross-agent assumptions                | Use agent-neutral wording and portable scripts or document limits |

Run `--strict` for advisory rules and `--format sarif` for code-scanning ingestion.
