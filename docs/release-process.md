# Releases & deployment

How a version of Specgate is cut and published — to npm, to the container
registry and to this documentation site — and what support it gets.

<!-- specgate:note -->
**GitHub Actions are switched off on the `rsaglobaltech` organisation**, to
save the free-minutes quota — every workflow except `pages.yml`, which
publishes this site. The process below describes what the workflows do when
they run; [How a release is done today](#how-a-release-is-done-today) is what
a maintainer actually does meanwhile.
<!-- specgate:endnote -->

## What gets published

| Artefact | Registry | Workflow | Status |
|---|---|---|---|
| `@rsaglobaltech/specgate` | npm, public | `publish-npm.yml` | Live — **0.22.0** is `latest` |
| `@rsaglobaltech/specgate` | GitHub Packages | `publish-github-packages.yml` | Workflow disabled between releases; newest **0.22.0** |
| CLI image | `ghcr.io` | `publish-docker.yml` | Workflow disabled between releases; newest image **0.22.0**, `linux/amd64` and `linux/arm64` |
| MCP server | inside the CLI package | `publish-npm.yml` | Live: `specgate mcp serve` |
| Documentation site and pack registry | GitHub Pages | `pages.yml` | Live — see [Deployment of the site](#deployment-of-the-site) |
| `specgate-maven-plugin` | Maven Central or an internal Nexus | none yet | C7-05 |
| `specgate-gradle-plugin` | Gradle Plugin Portal or an internal repo | none yet | C7-06 |
| `specgate-vscode` | VS Code Marketplace | none yet | C7-07 |
| `@specgate/lsp-server` | npm | none yet | C7-08, blocked on C6-03 |

The two `@rsaglobaltech/specgate` rows are one coordinate in two registries, on
purpose. Public npm is the default; routing the scope with
`@rsaglobaltech:registry=https://npm.pkg.github.com` gets the GitHub copy.

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

**Docker.** Images are tagged `X.Y.Z` and `latest`, for `linux/amd64` and
`linux/arm64`. While `publish-docker.yml` is disabled, `latest` is the newest
image that was built — **0.17.10** — not the newest npm version. A published
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
   `main` had failed. `publish-npm.yml` fires, and publishes only after the
   E2E workflow passes on all three platforms.
7. Write the GitHub release notes from the changelog entry.
8. Run the E2E against what the registry serves:
   `curl -sfLO https://registry.npmjs.org/@rsaglobaltech/specgate/-/specgate-X.Y.Z.tgz && npm run e2e -- --tarball specgate-X.Y.Z.tgz`.
   The CDN can answer 404 for a few minutes after `dist-tags` already says the
   new version; wait, do not republish.

## How a release is done today

With Actions switched off, nothing above runs by itself, so the maintainer
runs the gate and switches on the publish workflows for exactly one tag. This
is how 0.19.1 shipped:

1. **Run everything the workflows would**, on the release branch:

   ```bash
   npm run build && npm run test:all       # the gate publish-npm.yml runs
   npm run lint && npm run format:check
   npm run docs:terminal:check && npm run docs:journey:check
   npm run pack:dry-run
   node e2e/run.mjs                        # the E2E the npm workflow gates on
   ```

2. **Changelog, version, recordings** — steps 1–3 of
   [Cutting a release](#cutting-a-release). Say in the pull request that CI did
   not run and what was run instead.
3. **`develop`, then `main`** — merge into `develop`, open the
   `develop → main` pull request, then fast-forward `main` to that exact
   commit with `git push origin "${R}:refs/heads/main"`.
4. **Publish** — enable the publish workflows, tag, push the tag. All three
   (`publish-npm.yml`, `publish-github-packages.yml`, `publish-docker.yml`)
   trigger on the same `v*` tag:

   ```bash
   for f in publish-npm publish-github-packages publish-docker; do gh workflow enable $f.yml; done
   git tag -a vX.Y.Z <release-sha> -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

   The tag runs the E2E journeys on Linux, macOS and Windows, then
   `test:all`, then publishes with provenance.
5. **Check the registry**, then switch the workflow off again:

   ```bash
   npm view @rsaglobaltech/specgate dist-tags     # latest: X.Y.Z
   npx @rsaglobaltech/specgate@X.Y.Z --version
   for f in publish-npm publish-github-packages publish-docker; do gh workflow disable $f.yml; done
   ```

   Only npm gates on the E2E (Windows included): 0.19.0 failed it after the
   other two published, so it shipped as 0.19.1 — a published tag is never rebuilt.

6. **Release notes** — `gh release create vX.Y.Z --notes-file <changelog entry>`.

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

`pages.yml` is the one workflow that stays on: the repository is public, so it
costs no minutes. It deploys with GitHub's Pages actions (no `gh-pages` branch) on every push to `main`
that touches any of `docs/**`, `packs/**`, `packages/pack-registry/**`,
`scripts/docs/**`, `package.json`, `schemas/**`, `.github/workflows/pages.yml`
or `README.md` — a fix to how the site renders changes no file under `docs/`.
It can also be run by hand (`workflow_dispatch`).

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
