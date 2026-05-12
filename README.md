# Codex SkillForge

[![CI](https://github.com/f0d010c/skillforge/actions/workflows/ci.yml/badge.svg)](https://github.com/f0d010c/skillforge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/codex-skillforge.svg)](https://www.npmjs.com/package/codex-skillforge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**ESLint for Codex skills and plugins.**

SkillForge helps Codex extension authors scaffold, lint, smoke-test, inspect, and package skills/plugins before they publish or submit them to a marketplace.

Listed in [awesome-codex-plugins](https://github.com/hashgraph-online/awesome-codex-plugins) under "Validate Before You Ship."

```bash
npx codex-skillforge lint .
```

Example output:

```text
SkillForge plugin lint found 3 issue(s):
[ERROR] plugin.skills.missing - Manifest path does not exist: ./skills/
[WARNING] skill.description.vague - Description should clearly say what the skill does and when Codex should use it.
[ERROR] metadata.openai-yaml.legacy-shape - agents/openai.yaml fields must live under interface:
```

## Why This Exists

Codex skills and plugins are small, powerful folders. They are also easy to get subtly wrong:

- weak skill descriptions that Codex will not trigger well
- stale `agents/openai.yaml` shapes
- plugin paths that are not `./`-relative
- missing bundled skills, hooks, MCP, app, or asset files
- plugins that work locally but are not marketplace-ready

SkillForge is not a marketplace. It is the publish-readiness check you run before sharing a Codex skill/plugin repo.

## Security Model

SkillForge is a CLI linter, not a Codex runtime plugin. Running `lint`, `doctor`, and `smoke` reads local files and reports issues; it does not install skills, load plugins into Codex, or execute scripts from the target project.

Commands that write files are explicit:

- `init` creates scaffold files in the destination you choose.
- `pack` writes release artifacts to an output directory.

For cautious use, pin the npm version, review the source, and start with read-only commands:

```bash
npx codex-skillforge@0.1.3 lint .
npx codex-skillforge@0.1.3 smoke ./path/to/skill
```

## Install

Run with npm:

```bash
npx codex-skillforge lint .
```

Or install it in a project:

```bash
npm install --save-dev codex-skillforge
npx skillforge lint .
```

After installing, you can use the shorter aliases:

```bash
skillforge lint .
csf lint .
```

## Demo

See a tiny working example repo:

[f0d010c/codex-skillforge-demo](https://github.com/f0d010c/codex-skillforge-demo)

See real-world scan notes:

[docs/real-world-scan.md](docs/real-world-scan.md)

## Real-World Cases

The `examples/real-world-cases/` folder contains tiny, intentionally flawed examples based on issues found while scanning public Codex plugin bundles:

- `missing-mcp-server-file`: plugin manifest points at `./mcp.json`, but the file is absent.
- `stale-skill-reference`: `SKILL.md` links to a reference file that no longer exists.
- `weak-trigger-description`: skill frontmatter is valid YAML, but too vague for reliable triggering.

Try them:

```bash
npx codex-skillforge lint examples/real-world-cases/missing-mcp-server-file
npx codex-skillforge lint examples/real-world-cases/stale-skill-reference
npx codex-skillforge lint examples/real-world-cases/weak-trigger-description --strict
```

## Quick Start

Create and check a new skill:

```bash
npx codex-skillforge init skill ./my-skill --name my-skill
npx codex-skillforge lint ./my-skill
npx codex-skillforge smoke ./my-skill
npx codex-skillforge pack ./my-skill
```

Check an existing Codex extension repo:

```bash
npx codex-skillforge lint .
```

If SkillForge is installed globally or in your project, the same workflow is shorter:

```bash
skillforge lint .
skillforge smoke ./my-skill
skillforge pack ./my-skill
```

## Commands

```bash
skillforge init skill ./my-skill --name my-skill
skillforge init plugin ./my-plugin --name my-plugin
skillforge init plugin ./hook-plugin --name hook-plugin --template hook-package

skillforge lint ./my-skill --format text
skillforge lint ./my-skill --format json
skillforge lint ./my-skill --format sarif
skillforge lint ./my-skill --strict

skillforge lint .
skillforge doctor .
skillforge smoke ./my-skill
skillforge pack ./my-plugin
```

`lint .` can inspect a repository-style collection and recursively find skill/plugin folders under paths like `.agents/skills` and `plugins`.

Default lint mode focuses on high-confidence publish-readiness problems. Use `--strict` to include advisory checks such as trigger-description quality, large skill bodies, unreferenced scripts, and plugin name/folder mismatch.

## GitHub Action

Use SkillForge in CI:

```yaml
name: SkillForge

on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint-codex-extensions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: f0d010c/skillforge@main
        with:
          path: .
          format: sarif
```

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
- explicit Markdown links and known resource references resolve.
- optional `agents/openai.yaml` uses the current nested `interface`, `policy`, and `dependencies` shape.
- strict mode: descriptions are concise, trigger-oriented, and front-loaded.
- strict mode: scripts are mentioned in `SKILL.md`.

Plugin checks:

- `.codex-plugin/plugin.json` exists and parses.
- plugin names are lowercase hyphen-case and match the folder.
- published metadata has useful `version` and `description`.
- `skills`, `mcpServers`, `apps`, `hooks`, and visual asset paths resolve.
- manifest file paths are `./`-relative and stay inside the plugin root.
- bundled skills are linted too.
- default `hooks/hooks.json` is detected and parsed.
- hook packages warn about the required `codex_hooks` feature flag.
- strict mode: plugin folder/name mismatch is reported.

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

`skillforge pack` writes:

- `<name>.zip`
- `INSTALL.md`
- `marketplace-entry.json`

## Exit Codes

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

Verify from a clean directory after npm publish:

```bash
mkdir skillforge-smoke
cd skillforge-smoke
npx codex-skillforge --version
npx codex-skillforge init skill ./demo-skill --name demo-skill
npx codex-skillforge lint ./demo-skill
```
