# pi-autoskills architecture

## Goal

Give pi autoskills-style local skill installation with explicit trust boundary.

User machine must never install arbitrary live upstream skills directly from Claude/Codex registries.

## Trust boundary

### Maintainer side

Maintainer sync pipeline pulls upstream skills, normalizes them into pi-compatible bundles, runs security review, then writes mirrored bundles into local registry.

### User side

User only installs from mirrored audited registry bundled with package or fetched from signed mirror later.

## Runtime flow

1. detect stack from dependencies, config files, config-file content, and workspace members
2. derive frontend heuristics from package signals and file-tree signals
3. map technologies and combos to canonical registry ids
4. load registry manifest
5. verify every file hash and bundle hash
6. reject blocked skills
7. copy verified bundles into `.pi/skills/`
8. write `.pi/autoskills-lock.json`

## Registry entry

Each skill entry stores:

- canonical `registryId`
- source kind: `claude`, `codex`, `pi`
- source repo + source path
- source commit sha
- allowed files
- `sha256` map per file
- `bundleHash`
- `review`
- `securityCheck`

## v1 limitations

Current implementation includes autoskills-inspired detection breadth, bundled audited registry install, strict manifest-only copy, and pinned upstream GitHub sync.

Still missing for fuller autoskills parity:

- stronger source-specific adapters for Claude and Codex registries
- richer normalization for linked references and multi-file source bundles
- signed downloadable remote registry distribution
- richer scoring and stack combo ranking
- explicit update workflow for already-installed skills

## Suggested next implementation slices

1. harden upstream source adapters per registry family
2. preserve and rewrite multi-file reference graphs more accurately
3. add JSON review artifact per synced skill
4. add CI registry validation
5. add `pi-autoskills update`
6. add signed remote mirror support
