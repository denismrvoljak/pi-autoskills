---
name: react-shadcn-patterns
description: React plus shadcn/ui guidance for composition, accessibility, and consistent design-system usage.
metadata:
  source_repo: pi-autoskills/registry
  source_path: react-shadcn-patterns/SKILL.md
  source_commit: local-dev
---

# React + shadcn/ui Patterns

## Intent

Use for React apps using shadcn/ui components and local design-system composition.

## Guidance

- treat generated shadcn files as project code; refactor them to fit local conventions
- compose primitives into app-specific components instead of spreading variant logic everywhere
- preserve keyboard, focus, and labeling behavior when customizing components
- keep styling tokens and variant names consistent across component families
- avoid deep prop drilling by lifting state to clear boundaries
- test dialog, menu, combobox, and form interactions after heavy customization

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
