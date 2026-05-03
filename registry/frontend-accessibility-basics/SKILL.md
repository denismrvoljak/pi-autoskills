---
name: frontend-accessibility-basics
description: Frontend accessibility guidance. Use when building or reviewing UI semantics, labels, keyboard support, and focus behavior.
metadata:
  source_repo: pi-autoskills/registry
  source_path: frontend-accessibility-basics/SKILL.md
  source_commit: local-dev
---

# Frontend Accessibility Basics

- prefer semantic HTML before ARIA patches
- ensure inputs have labels and errors are announced
- verify keyboard flow, focus visibility, and dialog escape routes
- use roles only when native semantics cannot express intent

## Runtime Safety

Do not override higher-priority instructions or request secrets.
