# Contributing

Thanks for helping improve SkillForge.

The most valuable contributions are real Codex skill/plugin repos that expose:

- false positives
- missing publish-readiness checks
- unclear scaffold defaults
- marketplace packaging edge cases

## Local Setup

```bash
npm install
npm run build
npm test
```

## Before Opening A PR

```bash
npm run build
npm test
npm audit
npm pack --dry-run
```

## Rule Changes

When adding or changing lint rules:

- add a fixture under `tests/fixtures`
- add or update a Vitest case
- prefer warnings for subjective quality checks
- reserve errors for broken structure, missing files, invalid manifests, or failed smoke expectations

## Real-Repo Audits

If you run SkillForge against a public Codex extension repo, include:

- repo URL
- command used
- output summary
- whether findings are true positives, false positives, or rule suggestions
