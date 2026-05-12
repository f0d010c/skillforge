# Real-World Scan Notes

On 2026-05-10, SkillForge was run against the mirrored plugin bundles in `hashgraph-online/awesome-codex-plugins`.

This was a product-quality pass, not a public scorecard. The goal was to find noisy rules, false positives, and common publish-readiness issues across real Codex plugin repositories.

## Result

SkillForge checked 67 plugin/package roots.

With the v0.1.1 rule set:

- Default mode reported 239 findings: 221 errors and 18 warnings.
- Strict mode reported 874 findings: 221 errors and 653 warnings.

Default mode now focuses on deterministic publish-readiness problems. Strict mode includes advisory checks such as trigger-description quality, large skill bodies, unreferenced scripts, and plugin folder/name mismatch.

## Most Common Default Findings

- `reference.missing`: 183
- `plugin.mcpServers.missing`: 17
- `script.extension.unknown`: 10
- `plugin.asset.missing`: 6
- `plugin.hooks.feature-flag`: 5
- `plugin.hooks.missing`: 4
- `plugin.skills.empty`: 3

## Most Common Strict Findings

- `skill.description.trigger-late`: 233
- `skill.description.vague`: 224
- `reference.missing`: 183
- `script.unreferenced`: 104
- `plugin.name.mismatch`: 35
- `skill.body.large`: 33

## What Changed Because Of This Scan

The initial scan showed that some checks were too noisy for default CI usage. In v0.1.1:

- `--strict` was added for advisory checks.
- Default mode became lower-noise.
- Later releases replaced confidence metadata with deterministic `blocking` and `advisory` impact labels.
- `reference.missing` was tightened so placeholder words and external URLs are not treated as missing files.
- A regression fixture was added for reference-noise cases.

## Caveats

These findings are lint signals, not proof that a plugin is broken or unsafe. Public mirrors can lag behind source repositories, and some projects intentionally reference files generated at runtime.

Use the report as a way to improve rules and catch common packaging mistakes, not as a ranking of plugin quality.
