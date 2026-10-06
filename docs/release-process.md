# Release process

Replaces the frozen `RELEASE_0.1.0_CHECKLIST.md`, which described a manual
0.1.0 dry run and had drifted (it claimed Node ≥ 18, and every box was
unticked long after 0.1.4 shipped).

## What gets published

| Artefact | Registry | Workflow | Status |
|---|---|---|---|
| `@rsaglobaltech/specgate` | npm, public | `publish-npm.yml` | Live |
| `@rsaglobaltech/specgate` | GitHub Packages | `publish-github-packages.yml` | Live |

The first two rows are the same coordinate in two registries, and that is
deliberate: one name to document, one name to type. Public npm is the default
resolution; a consumer who routes the scope with
`@rsaglobaltech:registry=https://npm.pkg.github.com` gets the GitHub Packages
copy of the same version instead.
| CLI image | `ghcr.io` | `publish-docker.yml` | Live, `linux/amd64` and `linux/arm64` |
| `specgate-maven-plugin` | Maven Central or an internal Nexus | none yet | C7-05 |
| `specgate-gradle-plugin` | Gradle Plugin Portal or an internal repo | none yet | C7-06 |
| `specgate-vscode` | VS Code Marketplace | none yet | C7-07 |
| `@specgate/mcp-server`, `@specgate/lsp-server` | npm | none yet | C7-08, blocked on C6-03 |

## The Specgate rename — one-time cutover

The package renamed from `create-spec-driven-app` to `specgate` in
[ADR-0024](specs/adr/0024-the-tool-is-renamed-the-format-is-not.md). The
workflows read the name from `package.json`, so the first tag cut after that
change publishes `specgate` with no workflow edit. Three things are **not**
automated, because each is a one-time act with no undo:

**1. Deprecate the old package, pointing at the new one.** Run once, after the
first `specgate` version is live on npm:

```bash
npm deprecate create-spec-driven-app \
  "Renamed to Specgate. Install @rsaglobaltech/specgate instead — same tool, same CLI, and csda still works as a binary alias."
```

Deprecating does **not** unpublish. Every existing version stays installable, so
a pinned dependency keeps resolving; users get a warning, not a failure. Do not
unpublish: npm blocks reusing an unpublished name, and someone's build would
break for no gain.

**2. The Docker image changes name with the same tag.** New tags land under
`ghcr.io/<owner>/specgate`. Tags already published as `csda` are never rebuilt
in place and keep working — that rule predates the rename and does not bend for
it.

**2b. The unscoped name is not available.** `specgate` on the public registry is
blocked by [`spec-gate`](https://www.npmjs.com/package/spec-gate): npm compares
new names with punctuation removed, so the two collide and the registry answers
`403 ... You may not perform that action with these credentials` — which reads
like a token problem and is not one. The package is `@rsaglobaltech/specgate`; see the
2026-09-01 addendum to [ADR-0024](specs/adr/0024-the-tool-is-renamed-the-format-is-not.md).
A `npm view <name>` returning 404 means *not published*, never *creatable* —
check a name by attempting a real publish.

**3. The sibling packages move to `@specgate/*`.** They were never published
under `@spec-driven/*` (verified: `npm view @spec-driven/core` → 404), so there
is nothing to deprecate — the scope change costs nothing.

**Sequencing that matters.** `README.md` and the guides describe the tool by its
new name, so the rename branch and the release that publishes `specgate` belong
to the same event. Merging the rename and not releasing leaves a README whose
first command does not resolve — the exact failure mode this project keeps
finding elsewhere, in its own front door.

## Versioning

Semantic versioning. The CLI and the companion packages version independently;
a CLI release does not force a bump of the VS Code extension.

**Tags are `vX.Y.Z`.** The publish workflows trigger on `v*`, and the two tags
that predate this document (`0.1.0-beta.1`, `0.1.4`) have no `v` prefix, which
is why the tag-triggered path had never once fired. Do not create unprefixed
tags.

## Support policy

**Which versions get fixes.** Pre-1.0, only the latest minor. Backports to an
older minor are not promised — the upgrade path is forward, and pretending
otherwise would be a commitment one maintainer cannot keep. The same table is
in [SECURITY.md](../SECURITY.md#supported-versions) for vulnerabilities
specifically.

**From 1.0 on, this is a commitment and not an intention.** One supported line
at a time, plus the previous minor for **six months** from the day its successor
ships. Security fixes and correctness fixes both; a feature does not get
backported.

Until 2026-08-26 this paragraph ended with an escape clause saying it held only
until the clause itself was deleted. Deleting it *is* the commitment — that was
the point of writing it that way — so it is gone, and the git history has the
wording for anyone who wants it. This closes `GATE-G5` on the road to 1.0.

What it costs is worth naming, because a promise nobody costed is how the first
version of this paragraph came to need an escape hatch: for six months after
every minor, two lines need a release path, and a fix that lands on `main` has
to be evaluated against the previous minor rather than only forward. If that
ever stops being sustainable, the honest move is to change this paragraph in a
release and say so under Breaking — not to quietly stop doing it.

**Node.js.** `package.json` declares `>=22` and CI tests Node 22 and 24 across
Linux, macOS and Windows — the floor and the current LTS, so a break at either
end shows up. Raising the floor is **breaking** for the CLI, never a quiet
minor: an `npx` invocation that used to work and now refuses to run is breaking,
whatever the changelog calls it.

The floor moved from 20 to 22 in August 2026, because Node 20 left LTS
maintenance that April and testing against an unsupported runtime proves
nothing. The rule from here: **the floor is a maintained LTS.** When one leaves
maintenance the floor moves in the next release, and the changelog says so under
Breaking.

**Docker.** Images are tagged `X.Y.Z` and `latest`, for `linux/amd64` and
`linux/arm64`. A published tag is never rebuilt in place — `0.2.0` shipped
amd64-only and the fix had to be `0.2.1`, because re-running a workflow against
an old tag checks out the workflow *as it was at that tag*. Pin `X.Y.Z` in CI
and treat `latest` as a convenience only.

## Compatibility windows

Three version numbers travel with a project, and they are checked, not merely
recorded. Both gates below were added after finding that the fields were
written by the CLI and read by nothing.

| Field | Where | This CLI supports | On mismatch |
| --- | --- | --- | --- |
| `schema_version` | `pack.yaml` | up to **1.2.0** | A pack declaring a newer schema is rejected with the reason and the upgrade command |
| `specops_version` | `.specops.lock` | **1** | A lockfile from a newer CLI is rejected on read |
| pack `version` | `.specops.lock` | any | Pinned; a content digest change fails the build — see [supply chain](supply-chain.md) |

**Older is always readable.** A pack on an older schema, or a lockfile with no
`specops_version` at all, works unchanged — those files predate the field, and
refusing them would strand existing projects to enforce a rule invented later.
Only *newer than this CLI* is refused, because `schemas/pack.schema.json` sets
`additionalProperties: false`: a newer minor is genuinely unreadable here, not
merely unfamiliar. Failing at the top with "upgrade the CLI" beats failing
twenty lines in with "unknown property".

**Bumping the pack schema** is a two-step release, in this order:

1. Ship the CLI that understands the new schema — raise `PACK_SCHEMA_VERSION`
   in `scripts/domain-pack/common.ts` in the same change as the field.
2. Only then publish packs that use it.

Reverse the order and every curated pack becomes uninstallable on the released
CLI. A unit test asserts that no pack in `packs/` declares a schema newer than
the CLI supports, so getting this backwards fails CI rather than users.

## Cutting a release

1. Update `CHANGELOG.md`. Every user-visible change gets a line; group by
   Added / Changed / Fixed / Removed.
2. Bump `version` in `package.json`.
3. Re-record the landing page's terminal: `npm run build && npm run docs:terminal`,
   then update the version in `docs/index.html`. The recording carries the
   version it was made from and a test compares the two, so skipping this fails
   the build rather than shipping a page that claims the wrong release.
4. Open a PR to **`develop`** — never straight to `main`. `main` is protected: the twelve required checks in
   [CONTRIBUTING.md](../CONTRIBUTING.md#required-checks) must be green, and the
   branch must be up to date with `main` before it will merge.
5. Merge into `develop`, wait for CI on `develop` itself, then fast-forward
   `main` to it. A release is cut from a `main` that has been green the whole
   way, not from one that was red for the twenty minutes it took to notice.
6. Tag the merge commit `vX.Y.Z` and push the tag. `publish-npm.yml` fires.
7. Write the GitHub release notes from the changelog entry.

## Pre-releases

Run `publish-github-packages.yml` manually (`workflow_dispatch`) with
`dist_tag: beta` and a version like `0.2.0-beta.1`. Pre-releases never go to
the public npm registry with the `latest` tag.

## Before you tag — the gate

`publish-npm.yml` gates on `npm run test:all` and a `pack:dry-run`, so a broken
tag cannot publish. Run the same things locally first — finding it here costs a
commit, finding it in the workflow costs a version number:

```bash
npm run verify        # typecheck · eslint · tests · pack dry-run
npm run format:check  # prettier — CI runs it, verify does not
npm run test:all      # every suite, including BDD and the package tests
npm run e2e           # the packed tarball, installed and driven end to end
npm pack --dry-run    # inspect the tarball contents
```

`npm run e2e` (`e2e/run.mjs`) packs this checkout, installs the tarball into an
empty directory and runs the journeys a team takes against the installed
binary: adopt, `new` → test → `done --strict`, a stale matrix, a hand-kept
matrix migrated, `ci init`, the harness, and an upgrade from the last published
version (`--skip-network` leaves that one out). It is also the `E2E` workflow,
on every pull request and on all three platforms, and **`publish-npm.yml` will
not publish a tag unless it passes**.

Check the tarball carries `bin/`, `dist/`, `templates/`, `examples/` and
`README.md`, and nothing else — no `.local`, no `dist/packages/**` for
unpublished packages, no coverage output.

## Verifying a published release

```bash
npx @rsaglobaltech/specgate@X.Y.Z --help
npx @rsaglobaltech/specgate@X.Y.Z init --config ./project.config --out /tmp --dry-run
```

## After the release

Open the next milestone and record the release in
[`mejoras/plan-cierre-enterprise.md`](../mejoras/plan-cierre-enterprise.md)
if it closes one of its tasks.
