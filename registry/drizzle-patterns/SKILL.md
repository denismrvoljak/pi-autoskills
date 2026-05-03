---
name: drizzle-patterns
description: Drizzle ORM guidance for schema design, query composition, migrations, and transaction safety.
metadata:
  source_repo: pi-autoskills/registry
  source_path: drizzle-patterns/SKILL.md
  source_commit: local-dev
---

# Drizzle ORM Patterns

## Intent

Use for Drizzle schema work, query design, migrations, and database-facing refactors.

## Guidance

- keep schema definitions close to domain concepts, not transport shapes
- prefer small query builders and reusable predicates over giant inline SQL fragments
- review nullability, defaults, and indexes when adding columns or relations
- treat migrations as production changes; make forward and rollback impact explicit
- keep transaction boundaries narrow and driven by business invariants
- verify generated SQL and runtime types match expected data contract

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
