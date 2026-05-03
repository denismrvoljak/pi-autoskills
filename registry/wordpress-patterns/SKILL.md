---
name: wordpress-patterns
description: WordPress guidance for plugin or theme work, hooks, templates, data safety, and upgrade-friendly changes.
metadata:
  source_repo: pi-autoskills/registry
  source_path: wordpress-patterns/SKILL.md
  source_commit: local-dev
---

# WordPress Patterns

## Intent

Use for WordPress plugins, themes, block work, and operational maintenance.

## Guidance

- prefer hooks, filters, and extension points over core edits
- separate presentation, persistence, and admin behavior clearly
- sanitize, validate, and escape data at correct boundaries for request, storage, and output
- keep plugin activation, migration, and uninstall behavior explicit and reversible
- respect capability checks, nonce handling, and multisite impact for admin features
- verify compatibility with Gutenberg, REST API, and major upgrade paths before shipping

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
