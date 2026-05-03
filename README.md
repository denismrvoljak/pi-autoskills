# pi-autoskills

Audited autoskills-style skill installer for pi.

`pi-autoskills` detects stack from project files, matches skills from Claude/Codex/pi registries, prefers bundled audited local copies, and when needed fetches upstream bundles, audits + rewrites them into local cache, then installs only audited copies into `.pi/skills/`.

## Why

- detect stack fast
- install useful pi skills with near-zero setup
- never install live upstream skill content without local audit + rewrite first
- keep bundled and cached registries hash-pinned and reproducible
- support both CLI usage and `/autoskills` inside pi

## Features

- `pi-autoskills` CLI
- `/autoskills` pi command
- bundled audited registry under `registry/`
- dynamic cache registry under `.pi/autoskills-registry/`
- dynamic fetch + audit fallback for missing upstream skills
- autoskills catalog adapter with GitHub-tree fallback discovery
- policy file for allow/deny repos and discovery thresholds
- per-skill audit artifacts under `.pi/autoskills-registry/.audit/`
- manifest verification with file sha256 + bundle hash
- strict install of manifest-listed files only
- static security scan for prompt-injection and risky shell patterns
- pi reviewer mode for model-based audits
- install target: `.pi/skills/`
- lockfile: `.pi/autoskills-lock.json`

## Requirements

- Node.js `>= 22`
- pnpm `>= 10` for development
- [pi](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) installed for `/autoskills` command and pi-based review mode

## Install

### Use CLI from source

```bash
pnpm install
node --experimental-strip-types ./bin/pi-autoskills.ts --dry-run
```

### Install into pi from local checkout

```bash
pi install /absolute/path/to/pi-autoskills
```

Project-local install:

```bash
pi install -l /absolute/path/to/pi-autoskills
```

Then inside pi:

```text
/autoskills
```

### After npm publish

Global CLI:

```bash
npm install -g pi-autoskills
pi-autoskills --dry-run
```

Or one-shot:

```bash
npx pi-autoskills --dry-run
```

Install package into pi from npm:

```bash
pi install pi-autoskills
```

Project-local package install into pi:

```bash
pi install -l pi-autoskills
```

## Quick start

### 1. Preview matches in project

```bash
pi-autoskills --project /path/to/project --dry-run
```

### 2. Install skills

```bash
pi-autoskills --project /path/to/project
```

### 3. Use inside pi

```text
/autoskills detect
/autoskills
/autoskills install
```

## CLI usage

```bash
pi-autoskills --dry-run
pi-autoskills --project /path/to/project
pi-autoskills --registry-dir /path/to/registry
pi-autoskills --cache-registry-dir /path/to/cache-registry
pi-autoskills --reviewer auto|static|pi|none
```

### Reviewer modes

- `static` — static checks only. Default for plain CLI.
- `pi` — static checks + model audit through pi harness.
- `auto` — try pi review, fall back to static.
- `none` — skip model review and keep static checks only.

Examples:

```bash
pi-autoskills --reviewer static
pi-autoskills --reviewer pi
pi-autoskills --reviewer auto
```

## What gets written

Bundled registry lives in `registry/`.

Dynamic cache registry lives in `.pi/autoskills-registry/` inside target project by default.

Policy file lives at `.pi/autoskills-policy.json` inside target project by default.

Installed skills go to:

```text
.pi/skills/
```

Lockfile:

```text
.pi/autoskills-lock.json
```

Audit artifacts:

```text
.pi/autoskills-registry/.audit/
```

## Install flow

1. detect stack
2. match mapped skills
3. discover extra candidates from autoskills catalog adapter, with GitHub-tree fallback
4. apply policy filters and ranking
5. check bundled registry + local cache registry
6. if skill missing locally, fetch upstream bundle by pinned source repo/path
7. normalize markdown bundle for pi
8. run static review and optional pi-based model review
9. write audited result into local cache registry with hashes + provenance
10. write audit artifact JSON
11. reject blocked skills
12. copy verified bundle into `.pi/skills/<skill-id>/`
13. write `.pi/autoskills-lock.json`

## Policy config

Default path:

```text
.pi/autoskills-policy.json
```

Example:

```json
{
  "allowRepos": ["clerk/*", "vercel-labs/*", "supabase/*"],
  "denyRepos": ["random/*"],
  "minDiscoveryScore": 9,
  "maxDiscoveredSkills": 6
}
```

Environment override:

```bash
export PI_AUTOSKILLS_POLICY=/absolute/path/to/policy.json
```

## Catalog config

Default catalog path in this project points at local autoskills registry clone.

Override with:

```bash
export PI_AUTOSKILLS_CATALOG_INDEX=/absolute/path/to/index.json
```

If catalog missing, discovery falls back to GitHub repo tree scans.

## Development

```bash
pnpm install
pnpm check
node --experimental-strip-types ./src/commands/validate-registry.ts
```

## Maintainer workflow

### Refresh local mirrored bundles

```bash
pnpm sync
pnpm validate-registry
```

### Sync upstream bundles into bundled registry

```bash
pnpm sync:upstream
pnpm validate-registry
```

Useful flags:

```bash
node --experimental-strip-types ./src/commands/sync.ts --only react-best-practices --no-review
node --experimental-strip-types ./src/commands/sync.ts --only vue --verbose --keep-temp
```

## Release checklist

### Before npm publish

```bash
pnpm check
node --experimental-strip-types ./src/commands/validate-registry.ts
```

Then:

- bump `package.json` version
- review `README.md`
- verify `files` list in `package.json`
- publish package
- test:
  - `npx pi-autoskills --dry-run`
  - `pi install pi-autoskills`
  - `/autoskills detect`

## Layout

```text
pi-autoskills/
├── bin/
│   └── pi-autoskills.ts
├── extensions/
│   └── autoskills.ts
├── registry/
│   ├── index.json
│   ├── next-playwright-testing/
│   └── react-tailwind-ui-patterns/
├── src/
│   ├── commands/
│   ├── detect.ts
│   ├── discovery.ts
│   ├── install.ts
│   ├── maps.ts
│   ├── match.ts
│   ├── policy.ts
│   ├── registry.ts
│   ├── security.ts
│   ├── sync.ts
│   └── types.ts
└── test/
```

## Next steps

Still worth improving:

- stronger source-specific adapters for Claude and Codex registry quirks
- richer normalization for linked references and multi-file source bundles
- native pi SDK reviewer instead of subprocess reviewer
- explicit `update` command for refreshing installed skills
- optional shared `.agents/skills/` mode

## License

MIT
