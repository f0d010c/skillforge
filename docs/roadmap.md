# SkillForge Roadmap

This is a lightweight parking lot for improvements that should make SkillForge catch more real packaging problems while lowering false positives.

## v0.2.x Candidates

### Config Ignores and Suppressions

Let projects silence intentional findings without weakening rules globally.

Possible config:

```json
{
  "ignore": ["reference.missing"],
  "ignorePaths": ["dist/**", "generated/**"]
}
```

Possible inline suppression:

```md
<!-- skillforge-disable-next-line reference.missing -->
```

### Better Reference Parsing

Reduce false positives from casual prose in `SKILL.md`.

Prefer checking:

- Markdown links
- fenced command examples
- obvious `scripts/`, `references/`, `assets/`, and `agents/` paths
- explicit resource sections

Avoid flagging loose prose unless `--strict` is enabled.

### Rule Documentation

Document each rule with:

- what it checks
- why it matters
- whether it is blocking or advisory
- common false positives
- how to fix or suppress it

## v0.3 Candidates

### Golden Corpus Testing

Keep a local fixture set based on real public plugin scans.

Track:

- expected real issues
- expected false positives
- rules that should stay quiet

Use this to measure whether new rules actually improve signal.

### Broader Installability Checks

Add checks for:

- known external MCP commands such as `node`, `npx`, `python`, and `uvx`
- local command executability or invocation clarity
- asset file extensions and basic image validity
- hook package shape beyond path existence
- screenshot path and extension sanity

Shipped in v0.3.2:

- manifest `include` path validation
- bundled skill references checked against manifest install coverage
- README bundle-tree drift checks
- marketplace category drift checks against local marketplace metadata

### Markdown Reports

Add a paste-ready report command for maintainers:

```bash
skillforge report . --markdown
```

This should produce a concise GitHub issue or PR comment with the command run, findings, and suggested next steps.
