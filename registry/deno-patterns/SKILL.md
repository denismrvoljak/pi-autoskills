---
name: deno-patterns
description: Deno project guidance for runtime APIs, modules, permissions, and deployment-aware code.
metadata:
  source_repo: pi-autoskills/registry
  source_path: deno-patterns/SKILL.md
  source_commit: local-dev
---

# Deno Patterns

## Intent

Use for Deno codebases using TypeScript, JSR or npm imports, and permission-aware runtime features.

## Guidance

- prefer standard web APIs and Deno built-ins before Node compatibility layers
- keep import specifiers stable, explicit, and easy to audit
- model permissions as part of runtime contract; document file, env, and network needs
- separate pure logic from Deno-specific IO for easier testing
- use `deno.json` tasks, lint, fmt, and test config as source of truth
- review deploy targets for edge/runtime differences before adding Node-specific packages

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
