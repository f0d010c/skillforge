# Example PR Body For External Repos

## Summary

This runs the Codex skill/plugin files through SkillForge and fixes a few publish-readiness issues:

- aligns plugin manifest paths with `./`-relative plugin-root paths
- improves skill trigger descriptions
- fixes missing or stale metadata references

## Validation

```bash
npx agent-skillforge lint .
```

## Notes

SkillForge is a small OSS linter for Codex skills/plugins. I am testing it against real extension repos and opening small fixes where the checks catch something actionable.
