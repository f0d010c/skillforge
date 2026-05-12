# Real-World Cases

These are tiny, intentionally flawed agent skill/plugin examples based on issue patterns found while scanning public Codex plugin bundles.

They are not random fixtures; each one maps to a common publish-readiness failure:

- `missing-mcp-server-file`: a plugin manifest references an MCP config file that is not shipped.
- `stale-skill-reference`: a skill points to a reference doc that was renamed or deleted.
- `weak-trigger-description`: a skill has valid frontmatter, but the description does not clearly say when an agent should use it.

Run:

```bash
npx agent-skillforge lint examples/real-world-cases/missing-mcp-server-file
npx agent-skillforge lint examples/real-world-cases/stale-skill-reference
npx agent-skillforge lint examples/real-world-cases/weak-trigger-description --strict
```
