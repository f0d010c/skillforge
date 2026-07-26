# Example PR Body For External Repos

## Summary

This runs the agent skill/plugin files through SkillForge and fixes a few publish-readiness issues:

- aligns the plugin manifest with the current ingestion contract
- improves skill trigger descriptions
- fixes missing or stale metadata references
- verifies the packaged archive contains required hidden manifests

## Validation

```bash
npx agent-skillforge lint .
```

## Notes

SkillForge is a small OSS linter for agent skills/plugins. I am testing it against real extension repos and opening small fixes where the checks catch something actionable.
