# Agent SkillForge

[![CI](https://github.com/f0d010c/skillforge/actions/workflows/ci.yml/badge.svg)](https://github.com/f0d010c/skillforge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agent-skillforge.svg)](https://www.npmjs.com/package/agent-skillforge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Deterministic authoring checks for Codex skills and plugins.

SkillForge scaffolds current-contract extensions, validates publish-readiness, checks portability, runs static trigger smoke cases, inspects local Codex setup, and creates bounded deterministic archives.

```bash
npx agent-skillforge lint .
```

## Why SkillForge

Agent extensions are small but easy to break:

- malformed or stale YAML frontmatter;
- incomplete plugin interface metadata;
- unsupported or misspelled manifest fields;
- missing skill, MCP, app, script, reference, or asset files;
- archives that omit hidden manifests or include repository-only material;
- vague trigger metadata and agent-specific portability assumptions.

SkillForge is a local CLI and GitHub Action. Read-only commands never execute scripts from the inspected project.

## Install

Run without installing:

```bash
npx agent-skillforge@latest lint .
```

Or pin it as a development dependency:

```bash
npm install --save-dev agent-skillforge
npx skillforge lint .
```

Available binaries are `agent-skillforge`, `skillforge`, `asf`, and the compatibility aliases `codex-skillforge` and `csf`.

Requires Node.js 20 or newer.

## Commands

### Scaffold

```bash
skillforge init skill ./my-skill --name my-skill
skillforge init plugin ./my-plugin --name my-plugin --author "My Team"
```

Generated skills include `SKILL.md`, `agents/openai.yaml`, and a starter static-smoke case. Generated plugins include current required author and interface metadata.

The legacy `hook-package` template keeps hook files outside `plugin.json`; current plugin validation rejects the unsupported top-level `hooks` field.

### Lint

```bash
skillforge lint ./my-skill
skillforge lint ./my-plugin --strict
skillforge lint ./my-plugin --profile marketplace
skillforge lint . --format json
skillforge lint . --format sarif
```

- `source` permits known build-generated MCP paths as advisories.
- `marketplace` requires referenced runtime files to exist.
- `--strict` adds subjective and maintainability advisories.
- Repository collections are discovered recursively and can use path ignores.

The current contract rejects unsupported manifest fields such as `include` and `hooks`. Plugin resources are packaged from conventional runtime directories, declared package files, and local references discovered from skill Markdown.

### Static smoke

```bash
skillforge smoke ./my-plugin
```

Static smoke is a deterministic lexical trigger heuristic, not an actual model evaluation. Examples may identify the expected routed skill:

```json
{
  "examples": [
    {
      "prompt": "Build an Android interface with Jetpack Compose.",
      "shouldTrigger": true,
      "expectedSkill": "android-design"
    },
    {
      "prompt": "Optimize this SQL query.",
      "shouldTrigger": false
    }
  ]
}
```

Use real fresh-agent evaluations when routing quality matters beyond a fast regression check.

### Compatibility

```bash
skillforge compat ./my-skill --target codex
skillforge compat ./my-skill --target claude
skillforge compat ./my-skill --target portable
```

Compatibility checks shared skill basics, agent-specific wording and paths, and obvious script portability gaps. Run it on a skill or a collection containing skills, not on an unrelated CLI repository.

### Doctor

```bash
skillforge doctor .
```

Doctor inspects the target, `$CODEX_HOME`, `$CODEX_HOME/skills`, the plugin cache, optional legacy `.agents/skills`, and personal or repository marketplace locations.

### Package

```bash
skillforge pack ./my-plugin
skillforge pack ./my-skill --out-dir ./artifacts
```

Packaging:

- refuses lint failures unless `--skip-lint` is explicit;
- requires exactly one skill or plugin root;
- includes `.codex-plugin/plugin.json` and other hidden contract files;
- uses an explicit runtime allowlist plus resolved local references;
- excludes Git data, tests, evals, caches, editor files, secrets, and temporary output;
- writes sorted entries with stable timestamps;
- verifies that the required manifest is present.

Plugin packaging also writes an install note and a personal-marketplace entry.

## Configuration

```json
{
  "name": "my-agent-extension",
  "type": "plugin",
  "examples": [],
  "checks": {
    "maxSkillMdLines": 500,
    "requireOpenAiYaml": false,
    "allowScripts": true
  },
  "lint": {
    "ignore": ["templates/**", "tests/fixtures/**"],
    "allowEmptyCollection": false
  }
}
```

Unknown configuration keys are errors so misspelled checks cannot silently disappear.

## GitHub Action

After 0.4.0 is released, pin that release:

```yaml
name: SkillForge

on:
  pull_request:

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
      - uses: f0d010c/skillforge@v0.4.0
        with:
          path: .
          profile: marketplace
          format: text
```

Do not use `@main` in production workflows.

## Development

```bash
npm ci
npm run check
npm run coverage
npm audit
npm pack --dry-run
```

The test suite covers lint contracts, scaffolding, current YAML parsing, smoke routing, doctor paths, deterministic archives, and required archive contents across Node 20, 22, and 24 on Linux plus Node 24 on Windows and macOS.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md).

## License

MIT.
