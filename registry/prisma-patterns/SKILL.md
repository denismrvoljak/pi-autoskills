---
name: prisma-patterns
description: Prisma guidance for schema evolution, query safety, relation loading, and migration discipline.
metadata:
  source_repo: pi-autoskills/registry
  source_path: prisma-patterns/SKILL.md
  source_commit: local-dev
---

# Prisma Patterns

## Intent

Use for Prisma schema work, query design, and migration review.

## Guidance

- model schema around domain invariants and access patterns, not UI convenience
- choose eager loading deliberately; avoid accidental N+1 and oversized payloads
- keep write transactions aligned with business invariants
- review nullable fields, defaults, and cascade behavior before migration generation
- prefer typed query helpers for repeated selection sets and filters
- check generated client and migration SQL when behavior matters

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
