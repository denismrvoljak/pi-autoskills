# pi-autoskills architecture

## Goal

Give pi autoskills-style local skill installation with explicit trust boundary.

User machine must never install arbitrary live upstream skills directly from Claude/Codex registries. Upstream bundles may be fetched on demand, but only after local normalization, audit, manifesting, and cache materialization.

## Trust boundary

### Maintainer side

Maintainer sync pipeline pulls upstream skills, normalizes them into pi-compatible bundles, runs security review, then writes mirrored bundles into local registry.

### User side

User installs only from verified local registries:

- bundled audited registry shipped with package
- project-local audited cache registry populated on demand after fetch + audit

## Runtime flow

1. detect stack from dependencies, config files, config-file content, and workspace members
2. derive frontend heuristics from package signals and file-tree signals
3. map technologies and combos to canonical registry ids
4. discover candidates from autoskills catalog adapter, with GitHub tree fallback
5. apply policy filters and ranking
6. check bundled registry and project-local cache registry
7. if skill missing locally, fetch upstream bundle from mapped source
8. normalize markdown files into pi bundle shape
9. run static review and optional pi-based model review
10. write local cache manifest entry with hashes + provenance
11. write audit artifact JSON for fetched skill
12. verify every file hash and bundle hash
13. reject blocked skills
14. copy verified bundles into `.pi/skills/`
15. write `.pi/autoskills-lock.json`

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

- stronger source-specific adapters for Claude and Codex registries beyond autoskills index ingestion
- richer normalization for linked references and multi-file source bundles
- signed downloadable remote registry distribution
- explicit update workflow for already-installed skills
- native pi SDK reviewer instead of subprocess reviewer

## Suggested next implementation slices

1. harden upstream source adapters per registry family
2. preserve and rewrite multi-file reference graphs more accurately
3. add JSON review artifact per synced skill
4. add CI registry validation
5. add `pi-autoskills update`
6. add signed remote mirror support
