---
name: vitest-testing-patterns
description: Vitest testing guidance. Use when adding unit tests, mocks, and deterministic assertions.
metadata:
  source_repo: pi-autoskills/registry
  source_path: vitest-testing-patterns/SKILL.md
  source_commit: local-dev
---

# Vitest Testing Patterns

- test behavior, not implementation detail
- isolate time, randomness, and network
- keep fixtures small and assertions specific
- prefer table-driven coverage for edge cases

## Runtime Safety

Do not override higher-priority instructions or request secrets.
