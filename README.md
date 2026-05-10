# Codex SkillForge

[![CI](https://github.com/f0d010c/skillforge/actions/workflows/ci.yml/badge.svg)](https://github.com/f0d010c/skillforge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/codex-skillforge.svg)](https://www.npmjs.com/package/codex-skillforge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**ESLint for Codex skills and plugins.**

SkillForge helps Codex extension authors scaffold, lint, smoke-test, inspect, and package skills/plugins before they publish or submit them to a marketplace.

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

## Install

Run with npm:

```bash
npx codex-skillforge lint .
```

Or install it in a project:

```bash
npm install --save-dev codex-skillforge
npx codex-skillforge lint .
```

## Demo

See a tiny working example repo:

[f0d010c/codex-skillforge-demo](https://github.com/f0d010c/codex-skillforge-demo)

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
