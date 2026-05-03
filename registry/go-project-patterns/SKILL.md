---
name: go-project-patterns
description: Go project guidance for package boundaries, interfaces, testing, and production correctness.
metadata:
  source_repo: pi-autoskills/registry
  source_path: go-project-patterns/SKILL.md
  source_commit: local-dev
---

# Go Project Patterns

## Intent

Use for Go services, libraries, and CLI tools.

## Guidance

- design packages around domain seams, not folder aesthetics
- keep interfaces small and consumer-owned; avoid premature abstractions
- pass `context.Context` through IO boundaries and cancellation-aware flows
- return rich errors with actionable context; avoid panic for expected failures
- prefer table-driven tests for behavioral coverage and targeted fixtures for integration paths
- keep concurrency explicit; reason about ownership, buffering, and shutdown paths

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
