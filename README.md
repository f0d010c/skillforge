# Codex SkillForge

Creator tooling for OpenAI Codex skills and plugins: scaffold, lint, smoke-test, inspect, and package ecosystem artifacts.

SkillForge is the “Prettier + ESLint + create-vite” layer for Codex creators. It is not a marketplace. It helps you build skills and plugins that are clean enough to install locally, share in a repo, or submit to a marketplace.

## Why This Exists

Codex skills and plugins are small, powerful folders. They are also easy to get subtly wrong:

- weak skill descriptions that Codex will not trigger well
- stale `agents/openai.yaml` shapes
- plugin paths that are not `./`-relative
- missing bundled skills, hooks, MCP, app, or asset files
- plugins that work locally but are not marketplace-ready

SkillForge catches those problems before users do.

## Quick Start

```bash
npm install
npm run build

node dist/cli.js init skill ./my-skill --name my-skill
node dist/cli.js lint ./my-skill
node dist/cli.js smoke ./my-skill
node dist/cli.js pack ./my-skill
```

When published to npm, the same flow becomes:

```bash
npx codex-skillforge init skill ./my-skill --name my-skill
npx codex-skillforge lint ./my-skill
```

## Commands

```bash
codex-skillforge init skill ./my-skill --name my-skill
codex-skillforge init plugin ./my-plugin --name my-plugin
codex-skillforge init plugin ./hook-plugin --name hook-plugin --template hook-package

codex-skillforge lint ./my-skill --format text
codex-skillforge lint ./my-skill --format json
codex-skillforge lint ./my-skill --format sarif

codex-skillforge lint .
codex-skillforge doctor .
codex-skillforge smoke ./my-skill
codex-skillforge pack ./my-plugin
```

`lint .` can inspect a repository-style collection and recursively find skill/plugin folders under paths like `.agents/skills` and `plugins`.

## Config

Add `skillforge.json` to a skill or plugin root:

```json
{
  "name": "my-codex-skill",
  "type": "skill",
  "examples": [
    {
      "prompt": "Use $my-codex-skill to review a React UI for visual issues.",
      "shouldTrigger": true
    }
  ],
  "checks": {
    "maxSkillMdLines": 500,
    "requireOpenAiYaml": false,
    "allowScripts": true
  }
}
```

## What It Checks

Skill checks:

- `SKILL.md` frontmatter has `name` and `description`.
- skill names are lowercase hyphen-case and under 64 characters.
- descriptions are concise, trigger-oriented, and front-loaded.
- Markdown and inline resource references resolve.
- scripts are mentioned in `SKILL.md`.
- optional `agents/openai.yaml` uses the current nested `interface`, `policy`, and `dependencies` shape.

Plugin checks:

- `.codex-plugin/plugin.json` exists and parses.
- plugin names are lowercase hyphen-case and match the folder.
- published metadata has useful `version` and `description`.
- `skills`, `mcpServers`, `apps`, `hooks`, and visual asset paths resolve.
- manifest file paths are `./`-relative and stay inside the plugin root.
- bundled skills are linted too.
- default `hooks/hooks.json` is detected and parsed.
- hook packages warn about the required `codex_hooks` feature flag.

## Install Targets

Codex reads local skills from repo and user locations such as:

```text
./.agents/skills/<skill-name>
$HOME/.agents/skills/<skill-name>
```

Plugins are distributed through marketplace files such as:

```text
./.agents/plugins/marketplace.json
$HOME/.agents/plugins/marketplace.json
```

`codex-skillforge pack` writes:

- `<name>.zip`
- `INSTALL.md`
- `marketplace-entry.json`

## CI

```yaml
- run: npx codex-skillforge lint . --format sarif
```

Exit codes:

- `0`: pass, or warnings only
- `1`: lint errors or failed smoke checks
- `2`: invalid CLI usage or unreadable input

## Release Checklist

Before publishing:

```bash
npm run build
npm test
npm audit
npm pack --dry-run
```
