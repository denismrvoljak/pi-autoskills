---
name: react-hook-form-zod-patterns
description: React Hook Form plus Zod guidance for form state, validation, and user-facing error flows.
metadata:
  source_repo: pi-autoskills/registry
  source_path: react-hook-form-zod-patterns/SKILL.md
  source_commit: local-dev
---

# React Hook Form + Zod Patterns

## Intent

Use for typed React forms validated with Zod.

## Guidance

- define Zod schema as source of truth for parsed form data
- keep default values, field names, and inferred types aligned with schema shape
- validate at field and submit boundaries based on UX need, not habit
- map server errors into form state deliberately; do not lose field association
- isolate reusable field components from form orchestration logic
- treat transforms, coercion, and optional fields as behavior requiring tests

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
