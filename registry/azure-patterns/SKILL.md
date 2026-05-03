---
name: azure-patterns
description: Azure architecture and operations guidance for app code, deployment, identity, and observability.
metadata:
  source_repo: pi-autoskills/registry
  source_path: azure-patterns/SKILL.md
  source_commit: local-dev
---

# Azure Patterns

## Intent

Use for Azure application development, deployment, service integration, and production hardening.

## Guidance

- prefer managed identity over embedded credentials
- isolate subscription, resource-group, and environment concerns
- keep deployment config declarative and environment-specific values externalized
- make retries, transient-fault handling, and throttling strategy explicit
- emit logs and metrics keyed by operation, tenant, and resource identifiers
- review network boundaries, secret stores, and RBAC before shipping

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
