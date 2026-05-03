---
name: node-express-patterns
description: Node.js plus Express guidance for route design, middleware boundaries, validation, and operability.
metadata:
  source_repo: pi-autoskills/registry
  source_path: node-express-patterns/SKILL.md
  source_commit: local-dev
---

# Node.js + Express Patterns

## Intent

Use for Express APIs, server middleware, and backend service refactors.

## Guidance

- keep routes thin; move business logic into services or domain modules
- validate request input at edge and normalize before core logic
- treat middleware order as behavior; keep auth, logging, parsing, and error flow explicit
- centralize error translation to HTTP responses
- keep async handlers safe; surface rejected promises to one error boundary
- make health checks, graceful shutdown, and config loading production-ready

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
