# Agent SkillForge

[![CI](https://github.com/f0d010c/skillforge/actions/workflows/ci.yml/badge.svg)](https://github.com/f0d010c/skillforge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agent-skillforge.svg)](https://www.npmjs.com/package/agent-skillforge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**ESLint for agent skills and plugins.**

SkillForge helps agent extension authors scaffold, lint, smoke-test, inspect, and package skills/plugins before they publish or submit them to a marketplace.

Codex is the first-class target today. Portable skill compatibility for Claude-style skills and cross-agent packages is now starting with `skillforge compat`.

Listed in [awesome-codex-plugins](https://github.com/hashgraph-online/awesome-codex-plugins) under "Validate Before You Ship."

```bash
npx agent-skillforge lint .
```

Example output:

```text
SkillForge plugin lint found 3 issue(s) (2 blocking, 1 advisory) [source]:
[ERROR blocking] plugin.skills.missing - Manifest path does not exist: ./skills/
[WARNING advisory] skill.description.vague - Description should clearly say what the skill does and when Codex should use it.
[ERROR blocking] metadata.openai-yaml.legacy-shape - agents/openai.yaml fields must live under interface:
```

## Why This Exists

Agent skills and plugins are small, powerful folders. They are also easy to get subtly wrong:

- weak skill descriptions that Codex will not trigger well
- stale `agents/openai.yaml` shapes
- plugin paths that are not `./`-relative
- missing bundled skills, hooks, MCP, app, or asset files
- packages that work locally but are not marketplace-ready
- skills that claim cross-agent compatibility but still contain agent-specific assumptions

SkillForge is not a marketplace. It is the publish-readiness check you run before sharing an agent skill/plugin repo.

## Security Model

SkillForge is a CLI linter, not an agent runtime plugin. Running `lint`, `compat`, `doctor`, and `smoke` reads local files and reports issues; it does not install skills, load plugins into Codex, or execute scripts from the target project.

Commands that write files are explicit:

- `init` creates scaffold files in the destination you choose.
- `pack` writes release artifacts to an output directory.

For cautious use, pin the npm version, review the source, and start with read-only commands:

```bash
npx agent-skillforge@0.3.0 lint .
npx agent-skillforge@0.3.0 compat . --target portable
```

## Install

Run with npm:

```bash
npx agent-skillforge lint .
```

Or install it in a project:

```bash
npm install --save-dev agent-skillforge
npx skillforge lint .
```

After installing, you can use the shorter aliases:

```bash
skillforge lint .
asf lint .
```

The old `codex-skillforge` binary remains available as a compatibility alias.

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
npx agent-skillforge lint examples/real-world-cases/missing-mcp-server-file
npx agent-skillforge lint examples/real-world-cases/stale-skill-reference
npx agent-skillforge lint examples/real-world-cases/weak-trigger-description --strict
```

## Quick Start

Create and check a new skill:

```bash
npx agent-skillforge init skill ./my-skill --name my-skill
npx agent-skillforge lint ./my-skill
npx agent-skillforge smoke ./my-skill
npx agent-skillforge pack ./my-skill
```

Check an existing agent extension repo:

```bash
npx agent-skillforge lint .
```

If SkillForge is installed globally or in your project, the same workflow is shorter:

```bash
skillforge lint .
skillforge compat . --target portable
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
skillforge lint ./my-plugin --profile marketplace
skillforge lint ./my-skill --strict

skillforge lint .
skillforge compat . --target portable
skillforge doctor .
skillforge smoke ./my-skill
skillforge pack ./my-plugin
```

`lint .` can inspect a repository-style collection and recursively find skill/plugin folders under paths like `.agents/skills` and `plugins`.

Default lint mode focuses on deterministic publish-readiness problems. Use `--strict` to include advisory checks such as trigger-description quality, large skill bodies, unreferenced scripts, and plugin name/folder mismatch.

## Compatibility

Use `compat` to check whether a skill/package is likely to work in a specific agent ecosystem.

```bash
skillforge compat . --target codex
skillforge compat . --target claude
skillforge compat . --target portable
```

`codex` runs Codex-oriented lint checks.

`claude` checks the shared `SKILL.md` basics expected by Claude-style skills.

`portable` combines both and adds warnings for agent-specific wording, `.claude/`, `.codex/`, `.agents/`, and obvious OS-specific script assumptions.

This is an analysis command, not an auto-converter.

## Profiles

Use profiles to match where the plugin is being checked:

```bash
skillforge lint . --profile source
skillforge lint . --profile marketplace
```

`source` is the default. It is friendlier for repository work and treats obvious build-generated paths such as `./dist/server.js` as advisories when a `package.json` build script exists.

`marketplace` is stricter. It treats every manifest path as something that must already be bundled, which is what users and install tooling need after publishing.

Issue output uses deterministic impact labels:

- `blocking`: likely to break install, discovery, packaging, or runtime setup.
- `advisory`: worth fixing, but not necessarily a publish blocker.

## GitHub Action

Use SkillForge in CI:

```yaml
name: SkillForge

on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint-agent-extensions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: f0d010c/skillforge@main
        with:
          path: .
          format: sarif
          profile: marketplace
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
- MCP server config parses and each server defines a `url` or `command`.
- MCP server `args` are arrays of strings.
- source profile downgrades missing build-generated command paths when a build script exists.
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
npx agent-skillforge --version
npx agent-skillforge init skill ./demo-skill --name demo-skill
npx agent-skillforge lint ./demo-skill
```
