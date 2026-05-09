# Public Repo Audit Notes

SkillForge was tested against a small sample of public Codex skill/plugin repositories to validate that the rules catch useful issues without requiring project-specific setup.

## Sample

- `openai/codex-plugin-cc`
- `sigridjineth/oh-my-codex`
- `OutlineDriven/odin-codex-plugin`
- `zeabur/agent-skills`
- `TheGreenCedar/codex-autoresearch`

## Results

- `TheGreenCedar/codex-autoresearch`: passed after tuning path parsing for inline script examples.
- `openai/codex-plugin-cc`: surfaced one weak trigger-description warning.
- `zeabur/agent-skills`: surfaced a plugin package-name/folder-name mismatch as a warning.
- `OutlineDriven/odin-codex-plugin`: surfaced missing references, long descriptions, late trigger wording, and unreferenced scripts across a large skill collection.
- `sigridjineth/oh-my-codex`: surfaced many trigger-description warnings, large `SKILL.md` files, missing figure assets, and hook feature-flag documentation.

## Rule Changes From The Audit

- Plugin manifest/folder name mismatch is now a warning, because repo-level packages may intentionally differ from plugin package names.
- Inline references such as `scripts/foo.mjs --flag` are no longer treated as missing files.
- Placeholder/reference patterns with angle brackets, regex syntax, or command arguments are ignored by path-resolution checks.

## Marketing Takeaway

The strongest message is not "generic linter." It is:

> Before you submit or share a Codex plugin, run SkillForge to catch publish-readiness issues.
