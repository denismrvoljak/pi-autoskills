# pi-autoskills

```bash
pi install /absolute/path/to/pi-autoskills
```

Audited autoskills-style installer for pi.

`pi-autoskills` detects stack from project files, matches curated skills from Claude/Codex/pi registries, verifies mirrored local registry files with hashes, then installs only audited copies into `.pi/skills/`.

## Goals

- detect common stack signals quickly
- match best local audited skills
- never install live random upstream skill content for end users
- keep registry hash-pinned and reproducible
- expose same workflow in CLI and pi command form

## Current shape

This repo now includes functioning v1 foundations:

- `pi-autoskills` CLI
- `/autoskills` pi command
- bundled audited registry under `registry/`
- all mapped skills mirrored locally and installable
- manifest verification with file sha256 + bundle hash
- strict install of manifest-listed files only
- static security scan for prompt-injection and risky shell patterns
- install target: `.pi/skills/`
- lockfile: `.pi/autoskills-lock.json`
- autoskills-inspired detector with:
  - package + devDependency detection
  - scoped package pattern detection
  - config-file detection
  - config-content detection
  - workspace detection for pnpm, npm workspaces, and Deno workspaces
  - frontend file heuristics
  - combo skill matching

## Development setup

```bash
pnpm install
pnpm check
```

## Install package into pi

### Local path

```bash
pi install /absolute/path/to/pi-autoskills
```

### Project-local

```bash
pi install -l /absolute/path/to/pi-autoskills
```

Then inside pi:

```text
/autoskills
```

## CLI usage

```bash
pi-autoskills --dry-run
pi-autoskills --project /path/to/project
pi-autoskills --registry-dir /path/to/registry
```

## pi command

```text
/autoskills
/autoskills detect
/autoskills install
```

- `detect` shows stack + matched skills
- default command asks for confirmation before installing
- `install` skips confirmation

## Registry model

Registry lives in `registry/`.

Each skill bundle gets:

- normalized directory name
- markdown-only files
- manifest entry with provenance
- `review.status`
- `securityCheck.status`
- `sha256` per file
- `bundleHash` across whole bundle

End-user install path:

1. detect stack
2. match skill ids
3. load local registry manifest
4. verify hashes
5. reject blocked skills
6. copy verified bundle into `.pi/skills/<skill-id>/`
7. write `.pi/autoskills-lock.json`

## Maintainer workflow

### Local mirrored bundles only

Create or edit mirrored skill bundles in `registry/<skill-id>/`, then refresh manifest:

```bash
pnpm sync
pnpm validate-registry
```

### Upstream maintainer sync

Fetch foreign skills from upstream GitHub repos, normalize into markdown-only pi bundles, run static review, then write registry entries:

```bash
pnpm sync:upstream
pnpm validate-registry
```

Flags:

```bash
node --experimental-strip-types ./src/commands/sync.ts --only react-best-practices --no-review
node --experimental-strip-types ./src/commands/sync.ts --only vue --verbose --keep-temp
```

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
│   ├── install.ts
│   ├── maps.ts
│   ├── match.ts
│   ├── registry.ts
│   ├── security.ts
│   └── types.ts
└── test/
```

## Next steps

Still worth improving:

- stronger source-specific adapters for Claude and Codex registry quirks
- richer normalization for linked references and multi-file source bundles
- score-based matching and combo ranking
- explicit `update` command for refreshing installed skills
- optional shared `.agents/skills/` mode

## License

MIT
