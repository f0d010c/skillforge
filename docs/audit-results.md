# Public Repo Audit Notes

SkillForge was tested against a small sample of public Codex skill/plugin repositories to validate that the rules catch useful issues without requiring project-specific setup. The project now targets broader agent skill/plugin validation, with Codex as the first mature rule set.

## What The Audit Proved

- Repository-level collection linting works on real-world layouts.
- Plugin manifest checks can distinguish hard failures from advisory warnings.
- Skill description checks are useful, but should remain warnings because wording is partly subjective.
- Path-resolution rules need to avoid treating inline command examples as file references.

## Rule Changes From The Audit

- Plugin manifest/folder name mismatch is now a warning, because repo-level packages may intentionally differ from plugin package names.
- Inline references such as `scripts/foo.mjs --flag` are no longer treated as missing files.
- Placeholder/reference patterns with angle brackets, regex syntax, or command arguments are ignored by path-resolution checks.

## Marketing Takeaway

The strongest message is not "generic linter." It is:

> Before you submit or share an agent skill/plugin, run SkillForge to catch publish-readiness issues.
