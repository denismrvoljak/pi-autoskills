---
name: aws-patterns
description: AWS delivery guidance for SDK, infra, security, and operational guardrails.
metadata:
  source_repo: pi-autoskills/registry
  source_path: aws-patterns/SKILL.md
  source_commit: local-dev
---

# AWS Patterns

## Intent

Use for AWS application code, infra changes, deployment design, and production reviews.

## Guidance

- prefer least-privilege IAM and explicit resource boundaries
- separate app logic, infra definition, and environment config
- make retries, idempotency, and timeout behavior explicit for networked workflows
- keep region, account, and environment assumptions visible in code and docs
- log request ids, service errors, and resource names needed for incident debugging
- review data residency, encryption, and secret handling before rollout

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
