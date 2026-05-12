# Launch Notes

## One-Liner

SkillForge is ESLint for Codex skills and plugins: scaffold, lint, smoke-test, and package Codex extensions before publishing.

## Short Post

I built a small OSS CLI for people making Codex skills/plugins.

Codex extensions are easy to package incorrectly: vague `SKILL.md` triggers, broken `./skills/` paths, stale `agents/openai.yaml`, missing hook files, marketplace metadata drift.

SkillForge gives authors a quick publish-readiness check:

```bash
npx agent-skillforge lint .
```

It also scaffolds skills/plugins, smoke-tests declared example prompts, and packs release artifacts with install notes.

Repo: https://github.com/f0d010c/skillforge

I am looking for Codex skill/plugin repos to test it against.

## Reddit / Hacker News Title Options

- I built an ESLint-style linter for Codex skills and plugins
- Before you publish a Codex plugin, run this linter
- SkillForge: publish-readiness checks for Codex skills/plugins

## Useful Reply To Feedback

Thanks. The main thing I am trying to validate is whether plugin authors want a stricter publish-readiness check before submitting to marketplaces. If you have a skill/plugin repo, I can run SkillForge against it and use the failures to improve the rules.

## Outreach Targets

- Codex plugin marketplace maintainers
- `awesome-codex-plugins` maintainers
- authors of public Codex skill/plugin repos
- r/codex
- OpenAI developer community posts about Codex skills/plugins
