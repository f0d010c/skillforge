# Changelog

## Unreleased

- Aligned plugin and skill validation with the current Codex ingestion contract.
- Replaced handwritten frontmatter parsing with full YAML parsing.
- Rebuilt packaging around deterministic allowlisted archives that retain hidden manifests.
- Updated generated plugin metadata and removed unsupported manifest fields.
- Added expected-skill static smoke assertions and clarified their heuristic scope.
- Updated doctor to inspect `$CODEX_HOME/skills`.
- Added formatting, coverage thresholds, dependency remediation, pinned CI actions, and broader command tests.

## 0.3.2 - 2026-05-13

- Added marketplace drift checks, configurable lint ignores, compatibility checks, and GitHub Action support.
