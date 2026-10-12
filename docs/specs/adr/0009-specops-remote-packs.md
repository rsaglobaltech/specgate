# ADR-0009: SpecOps — Remote Packs and `.specops.lock`

**Date:** 2026-05-12
**Status:** Accepted

## Context

Until now, `expand` only accepted a local `--pack-root <dir>`. To consume a
shared domain pack (e.g.
`rsaglobaltech/parking-management-specops`), users had to script their own
`git clone` + path-juggling outside the CLI. That works but produces three
problems:

1. **No reproducibility.** Nothing in the generated project records _which
   version of the pack_ was expanded. Re-running `expand` against a moving
   target silently changes outputs.
2. **High friction.** Every adopter needs their own `run_pack.sh`. The
   "happy path" is multiple lines of bash, not a single `npx` invocation.
3. **Drift is invisible.** When the pack evolves upstream, the project has
   no audit trail of which commit it was last synced against.

The "SpecOps" model that motivates this work treats the **domain pack as a
versioned dependency** of the implementation project — analogous to how
npm/Cargo/Go-modules treat libraries. To make that real, the CLI itself
must understand remote pack references and write a lockfile that captures
the resolved version.

## Decision

Extend `expand` with three new flags and emit a `.specops.lock` file when
a remote pack is used.

### New flags on `expand`

| Flag | Meaning |
|---|---|
| `--pack-repo <git-url>`     | Git URL of the pack repository |
| `--pack-version <ref>`      | Tag or SHA to check out (required with `--pack-repo`) |
| `--cache-dir <path>`        | Override the default cache root (used by tests) |

Mutually exclusive with `--pack-root`. The CLI clones into
`~/.cache/specgate/packs/<sha256(repo)[:16]>/<sanitised-version>/`, resolves the
local path, and proceeds with the existing expand pipeline.

### `.specops.lock` format

JSON, written to the project root after a successful (non–dry-run) expand:

```json
{
  "specops_version": 1,
  "specgate_version": "0.1.0-beta.4",
  "packs": [
    {
      "repo":        "https://github.com/rsaglobaltech/parking-management-specops.git",
      "version":     "v0.1.0",
      "commit":      "c37fbcb…",
      "pack_id":     "backend",
      "expanded_at": "2026-05-12T18:30:00.000Z"
    }
  ]
}
```

Multiple packs are supported (one entry per `(repo, pack_id)` pair). The
file is sorted deterministically by `repo` then `pack_id` so re-running
`expand` produces stable diffs.

### Caching strategy

- Cache key = `sha256(repo)[:16]` + sanitised version directory.
- A `.git` directory inside the cache slot means "already cloned"; the CLI
  reuses it and only calls `git rev-parse HEAD` to read the commit.
- `force: true` (programmatic) deletes and re-clones; there is no
  user-facing flag for this yet — re-pulls are explicit by deleting the
  cache dir.
- Tries `git clone --depth 1 --branch <ref>` first; falls back to a full
  clone + detached checkout when `--branch` rejects the ref (typical for
  SHAs).

## Consequences

**Positive:**

- A single `npx create-spec-driven-app expand --pack-repo … --pack-version
  …` reproduces a project from any tagged pack without auxiliary scripts.
- Lockfile makes "which pack version is this project on?" answerable from
  the repo, not from team knowledge.
- Future `specops sync` / `specops diff` commands have a stable file to
  read and update.
- The fallback path (full clone + detached checkout) supports pinning by
  commit SHA, which is the most reproducible option.

**Negative / accepted trade-offs:**

- `git` becomes a hard runtime requirement when `--pack-repo` is used. The
  CLI detects this and exits with a clear error if `git` is missing; the
  local `--pack-root` path is unaffected.
- Cache invalidation is now the user's problem: if a tag is force-moved
  upstream (which should never happen, but does), the cached slot still
  resolves to the old commit. Documented as a deliberate trade-off.
- The lockfile is a new artifact the user must check into Git. We do not
  generate `.gitignore` entries for it; it's intentional.

## Rejected alternatives

- **Bundle packs as npm packages.** Considered, rejected for now: forces
  every pack author to publish to npm, adds a slow pipeline, and bakes in
  semver semantics that don't fit DDD evolution (where status transitions
  matter more than API breakage). Git + tags is the lowest-friction
  versioning that works today.
- **Embed a YAML or TOML lockfile.** JSON is sufficient, parseable from
  every language without a new dep, and produces stable diffs without a
  custom serialiser.
- **Reuse `npm install` for remote packs.** Investigated: would require
  packs to ship as npm packages and complicate the contract (npm tarballs
  flatten directory structure). Rejected in favour of native git access.

## References

- [Pack format spec](../domain-pack-format.md)
- Module: `scripts/domain-pack/remote.js`
- Module: `scripts/specops/lock.js`
- Reference SpecOps repo: `rsaglobaltech/parking-management-specops`
