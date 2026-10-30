# Releases & deployment

How a version of Specgate is cut and published — to npm, to the container
registry and to this documentation site — and what support it gets.

<!-- specgate:note -->
**GitHub Actions are on** (since 2026-10-28): the repository is public, so
standard GitHub-hosted runners cost nothing. CI (`ci.yml`, which calls the E2E
journeys in `e2e.yml`) runs on every push to `main`, `develop` and `next/**` and
on pull requests, Security on `main`, `next/**` and pull requests; `release.yml`
runs on a `v*` tag; `scheduled.yml` holds the weekly checks that never gate. They were off for months to save a quota that public repositories
do not have.
<!-- specgate:endnote -->

## What gets published

| Artefact | Registry | Workflow | Status |
|---|---|---|---|
| `@rsaglobaltech/specgate` | npm, public | `release.yml` (job `npm`) | Live — **0.27.9** is `latest` |
| `@rsaglobaltech/specgate` | GitHub Packages | none — no longer published | Newest **0.27.9**, the last one |
| CLI image | `ghcr.io` | `release.yml` (job `docker`) | Live — newest image **0.27.9**, `linux/amd64` and `linux/arm64` |
| MCP server | inside the CLI package | `release.yml` (job `npm`) | Live: `specgate mcp serve` |
| Documentation site and pack registry | GitHub Pages | `pages.yml` | Live — see [Deployment of the site](#deployment-of-the-site) |
| `specgate-maven-plugin` | Maven Central or an internal Nexus | none yet | C7-05 |
| `specgate-gradle-plugin` | Gradle Plugin Portal or an internal repo | none yet | C7-06 |
| `specgate-vscode` | VS Code Marketplace | none yet | C7-07 |
| `@specgate/lsp-server` | npm | none yet | C7-08, blocked on C6-03 |

The two `@rsaglobaltech/specgate` rows were one coordinate in two registries.
The GitHub Packages copy stopped with 0.27.9: its versions stay installable by
routing the scope with `@rsaglobaltech:registry=https://npm.pkg.github.com`,
but new versions are on public npm only.

## The Specgate rename — done, and what it left behind

The package was renamed from `create-spec-driven-app` to
`@rsaglobaltech/specgate` in
[ADR-0024](specs/adr/0024-the-tool-is-renamed-the-format-is-not.md). The old
package is deprecated, not unpublished — every version stays installable, so a
pinned dependency keeps resolving with a warning. The unscoped name `specgate`
is unavailable: npm compares names without punctuation, so it collides with
`spec-gate` and the registry answers `403`, which reads like a token problem and
is not one. Docker images moved to `ghcr.io/<owner>/specgate`; tags published
under the old image name are never rebuilt. Since
[ADR-0032](specs/adr/0032-one-name-everywhere.md) nothing else keeps the old
name: no binary alias, and the on-disk format, cache and environment variables
are all `specgate`.

## Versioning

Semantic versioning. The CLI and the companion packages version independently;
a CLI release does not force a bump of the VS Code extension.

**Tags are `vX.Y.Z`.** The release workflow triggers on `v*`, and the two tags
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

What it costs: for six months after every minor, two lines need a release
path, and a fix on `main` has to be evaluated against the previous minor too.
If that ever stops being sustainable, the honest move is to change this
paragraph in a release and say so under Breaking — not to quietly stop.

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

**Docker.** Images are tagged `X.Y.Z`, `X.Y` and `latest`, for `linux/amd64`
and `linux/arm64`; a prerelease gets its version tag only, so `latest` is the
newest final version (REQ-281). A published
tag is never rebuilt in place: re-running a workflow against an old tag checks
out the workflow *as it was at that tag*. Pin `X.Y.Z` in CI.

## Compatibility windows

Three version numbers travel with a project, and they are checked, not merely
recorded. Both gates below were added after finding that the fields were
written by the CLI and read by nothing.

| Field | Where | This CLI supports | On mismatch |
| --- | --- | --- | --- |
| `schema_version` | `pack.yaml` | up to **1.5.0** | A pack declaring a newer schema is rejected with the reason and the upgrade command |
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
   in `packages/core/src/domain/PackSpec.ts` in the same change as the field.
2. Only then publish packs that use it.

Reverse the order and every shipped pack becomes uninstallable on the released
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
4. Open a PR to **`develop`** — never straight to `main`, which is protected:
   the thirteen [required checks](../CONTRIBUTING.md#required-checks) must pass.
5. Merge into `develop`, wait for CI on `develop` itself, then fast-forward
   `main` to it. A release is cut from a `main` that has been green the whole
   way, not from one that was red for the twenty minutes it took to notice.

   Three of `main`'s required checks (`npm audit`, `CodeQL`, `SBOM and
   licences`) only run on pull requests, so open a PR `develop → main` first:
   it runs all of them on the release commit. Then push that exact commit:

   ```bash
   git push origin <release-sha>:refs/heads/main   # fast-forward only, never --force
   ```

   **Quote the refspec: `"${R}:refs/heads/main"`.** In zsh, `$R:refs/…`
   applies the `:r` modifier and no longer names the commit. Read the output.
6. **Only once `git rev-parse origin/main` is the release commit**, tag it
   `vX.Y.Z` and push the tag. On 0.10.0 the tag went out while the push to
   `main` had failed. `release.yml` fires, and publishes only after the whole
   of `ci.yml` — E2E on all three platforms included — passes on the tag.
7. Write the GitHub release notes from the changelog entry.
8. Run the E2E against what the registry serves:
   `curl -sfLO https://registry.npmjs.org/@rsaglobaltech/specgate/-/specgate-X.Y.Z.tgz && npm run e2e -- --tarball specgate-X.Y.Z.tgz`.
   The CDN can answer 404 for a few minutes after `dist-tags` already says the
   new version; wait, do not republish.

## How a release is done today

CI runs the gate on the release branch's pull request; the maintainer may run
it locally too (WSL for Linux), then tags. This is how 0.27.4 shipped:

1. **Run everything the workflows would**, on the release branch:

   ```bash
   npm run build && npm run test:all       # the suites release.yml's verify job runs
   npm run lint && npm run format:check
   npm run docs:terminal:check && npm run docs:journey:check
   npm run pack:dry-run
   node e2e/run.mjs                        # the E2E the release gates on
   ```

2. **Changelog, version, recordings** — steps 1–3 of
   [Cutting a release](#cutting-a-release).
3. **`develop`, then `main`** — merge into `develop`, open the
   `develop → main` pull request, then fast-forward `main` to that exact
   commit with `git push origin "${R}:refs/heads/main"` (an admin bypass: only a commit step 1 ran).
4. **Publish** — tag, push the tag. `release.yml` triggers on it:

   ```bash
   git tag -a vX.Y.Z <release-sha> -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

   The tag runs `ci.yml` (job `Verify`, E2E on all three platforms included),
   then npm with provenance, then the image: wait for the one `Release` run.
5. **Check the registry:**

   ```bash
   npm view @rsaglobaltech/specgate dist-tags     # latest: X.Y.Z
   npx @rsaglobaltech/specgate@X.Y.Z --version
   ```

   The image waits for npm, npm for the E2E. Before `release.yml` only npm
   did: 0.19.0 failed the E2E after the other two published, so it shipped as
   0.19.1 (0.27.0 too, as 0.27.1) — a published tag is never rebuilt.

6. **Release notes** — `gh release create vX.Y.Z --notes-file <changelog entry>`.

## Pre-releases

A version with a prerelease part (`1.0.0-rc.1`, cut from the `next/1.0` branch,
never from `main`) is tagged like any release: the workflows publish it under
the dist-tag `next` and tag its image with the version only, never `latest`
(REQ-281). Its GitHub release is created with `--prerelease`.

## Before you tag — the gate

`release.yml` gates on the whole of `ci.yml` and a `pack:dry-run`, so a broken
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
version (`--skip-network` leaves that one out). It is also the `E2E` job of
`ci.yml` (`e2e.yml`), on every pull request and on all three platforms, and
**`release.yml` will not publish a tag unless it passes**.

Check the tarball carries what `files` in `package.json` lists — `bin/`,
`dist/bin/`, `dist/scripts/`, `dist/packages/core/`,
`dist/packages/mcp-spec-driven/src/`, `templates/`, `examples/`, `vendor/`,
`README.md` and `CHANGELOG.md` — and nothing else — no `.local`, no `dist/packages/**` for
unpublished packages, no coverage output.

## Verifying a published release

```bash
npx @rsaglobaltech/specgate@X.Y.Z --version
npx @rsaglobaltech/specgate@X.Y.Z init --yes --dry-run   # in an empty directory
npx @rsaglobaltech/specgate@X.Y.Z draft                   # explains the brief it needs
```

## After the release

Write the GitHub release notes from the changelog entry, leave an empty
`## [Unreleased]` at the top of `CHANGELOG.md`, and open the next milestone.

## Deployment of the site

`pages.yml` deploys with GitHub's Pages actions (no `gh-pages` branch) on every push to `main`
that touches any of `docs/**`, `packs/**`, `packages/pack-registry/**`,
`scripts/docs/**`, `package.json`, `schemas/**`, `.github/workflows/pages.yml`
or `README.md` — a fix to how the site renders changes no file under `docs/`.
It can also be run by hand (`workflow_dispatch`). On a pull request that
touches `docs/**`, `scripts/docs/**`, `packs/**` or `packages/pack-registry/**`
it builds the site without uploading or deploying it.

A run builds the TypeScript, then writes into `_site/`:

1. **The documentation site** — `node dist/scripts/docs/build-site.js --out _site`
   renders every page under `docs/` and copies the landing page and assets.
2. **This repository's own coverage report** — `/report.html`, from
   `specgate report` — a snapshot from the last deploy.
3. **The pack registry** — `/packs/index.html` and `/packs/manifest.json`,
   from every pack under `packs/`.

### Custom domain

To serve it from a custom domain such as `packs.spec-driven.dev`:

1. **Add a repository variable** named `SITE_CNAME` set to the domain
   (Settings → Secrets and variables → Actions → Variables). The workflow
   only writes a `CNAME` file when the variable exists, so the deployment is
   safe before the domain is configured.
2. **Point DNS** at GitHub Pages — see
   <https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site>.
3. **Enable HTTPS** in Settings → Pages once the certificate is issued.
4. **Re-run the workflow** so the `CNAME` file is published.

### Local preview

```bash
npm run build
node dist/scripts/docs/build-site.js --out _site            # without --out it writes ./_site
node dist/packages/pack-registry/src/build.js --out _site/packs
npx serve _site                                             # http://localhost:3000/ — delete _site/ after
```

### Verifying a deployment

```bash
curl -sI https://rsaglobaltech.github.io/specgate/packs/manifest.json | head -1
# expect: HTTP/2 200
curl -s  https://rsaglobaltech.github.io/specgate/packs/manifest.json | jq '.packs | length'
# expect: as many packs as packs/ holds — find packs -name pack.yaml | wc -l
```
