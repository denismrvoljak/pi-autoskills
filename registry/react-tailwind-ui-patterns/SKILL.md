---
name: react-tailwind-ui-patterns
description: React plus Tailwind UI guidance. Use when building components, composing utility classes, and reviewing frontend implementation tradeoffs.
metadata:
  source_repo: pi-autoskills/registry
  source_path: react-tailwind-ui-patterns/SKILL.md
  source_commit: local-dev
---

# React + Tailwind UI Patterns

## Intent

Use for React components styled with Tailwind CSS.

## Guidance

- prefer small presentational components over giant view files
- keep class lists grouped by layout, spacing, typography, interaction
- extract repeated utility combinations into helper components when repetition becomes noisy
- preserve semantic HTML first, then styling
- watch for responsive class conflicts and dead utility churn

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
