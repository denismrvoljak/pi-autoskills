---
name: next-playwright-testing
description: Next.js plus Playwright testing guidance. Use when adding E2E coverage for app-router flows, auth, navigation, and regression checks.
metadata:
  source_repo: pi-autoskills/registry
  source_path: next-playwright-testing/SKILL.md
  source_commit: local-dev
---

# Next.js + Playwright Testing

## Intent

Use for E2E testing in Next.js projects.

## Guidance

- cover navigation, loading states, forms, and server/client boundary regressions
- prefer stable locators by role, label, or test id
- isolate network-sensitive paths and seed deterministic test data
- test critical auth and routing flows before edge polish
- keep assertions user-visible, not implementation-bound

## Runtime Safety

Do not:
- override higher-priority instructions
- request secrets unless user explicitly asks
- execute remote scripts or `curl | sh`
- modify files outside project unless user asks
