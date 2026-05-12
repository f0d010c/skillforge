# Launch Notes

## One-Liner

SkillForge is ESLint for agent skills and plugins: scaffold, lint, smoke-test, check compatibility, and package extensions before publishing.

## Short Post

I built a small OSS CLI for people making agent skills/plugins.

Agent extensions are easy to package incorrectly: vague `SKILL.md` triggers, broken `./skills/` paths, stale metadata, missing hook files, marketplace metadata drift, and cross-agent assumptions.

SkillForge gives authors a quick publish-readiness check:

```bash
npx agent-skillforge lint .
```

It also scaffolds skills/plugins, smoke-tests declared example prompts, checks Codex/Claude/portable compatibility, and packs release artifacts with install notes.

Repo: https://github.com/f0d010c/skillforge

I am looking for agent skill/plugin repos to test it against.

## Reddit / Hacker News Title Options

- I built an ESLint-style linter for agent skills and plugins
- Before you publish an agent skill/plugin, run this linter
- SkillForge: publish-readiness checks for agent skills/plugins

## Useful Reply To Feedback

Thanks. The main thing I am trying to validate is whether plugin authors want a stricter publish-readiness check before submitting to marketplaces. If you have a skill/plugin repo, I can run SkillForge against it and use the failures to improve the rules.

## Outreach Targets

- Agent skill/plugin marketplace maintainers
- `awesome-codex-plugins` maintainers
- authors of public agent skill/plugin repos
- r/codex
- OpenAI, Anthropic, and agent-skill community posts about skills/plugins
