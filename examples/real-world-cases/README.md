# Real-World Cases

These are tiny, intentionally flawed agent skill/plugin examples based on issue patterns found while scanning public Codex plugin bundles.

They are not random fixtures; each one maps to a common publish-readiness failure:

- `missing-mcp-server-file`: a plugin manifest references an MCP config file that is not shipped.
- `stale-skill-reference`: a skill points to a reference doc that was renamed or deleted.
- `weak-trigger-description`: a skill has valid frontmatter, but the description does not clearly say when an agent should use it.
- `plugin-missing-include`: bundled skills reference plugin-level resources that are not declared in manifest `include`.
- `plugin-readme-stale-path`: a README file tree documents folders that are absent from the installable bundle.
- `marketplace-category`: local marketplace metadata and plugin manifest categories disagree.

Run:

```bash
npx agent-skillforge lint examples/real-world-cases/missing-mcp-server-file
npx agent-skillforge lint examples/real-world-cases/stale-skill-reference
npx agent-skillforge lint examples/real-world-cases/weak-trigger-description --strict
npx agent-skillforge lint examples/real-world-cases/plugin-missing-include --profile marketplace
npx agent-skillforge lint examples/real-world-cases/plugin-readme-stale-path --profile marketplace
npx agent-skillforge lint examples/real-world-cases/marketplace-category/plugins/acme/stark --profile marketplace
```
