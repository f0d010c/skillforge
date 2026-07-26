# Contributing

The most valuable SkillForge contributions reduce false positives, catch real install or packaging failures, or keep generated output aligned with current agent contracts.

## Setup

```bash
npm ci
npm run check
npm run coverage
```

Before opening a pull request:

```bash
npm audit
npm pack --dry-run
git diff --check
```

## Rule changes

- Add a focused fixture or temporary-directory test.
- Include both positive and negative cases.
- Reserve errors for invalid contracts, broken installation, unsafe packaging, or failed explicit expectations.
- Use warnings for subjective quality and maintainability guidance.
- Verify generated templates, not only handwritten fixtures.
- Keep current contract rules in `src/lib/contracts.ts`.
- Avoid duplicating packaging policy outside `src/lib/package-files.ts`.

For a real-repository report, include the repository URL, exact command, tool version, finding classification, and minimal reproduction.

## Pull requests

Describe the failure mode, behavior change, evidence, compatibility impact, and intentionally deferred work. Changes to a public rule code should document whether it is new, renamed, or removed.
