# Supply chain

This page lists what Specgate fetches, writes and sends, and what protects
each of those: domain packs (pinned, digested, optionally signed), the
credentials the Jira and GitHub commands use, offline use, and the tool's own
dependencies.

A **domain pack** is a dependency that writes files into your repository: a
set of ready-made requirements and scenarios for a business domain. That makes
it the largest attack surface this tool has.

For reporting a vulnerability, see [SECURITY.md](../SECURITY.md).

## What a pack can do

`specgate specops add` clones a pack repository at a pinned tag and renders its
templates into your project. Rendering writes files. It does not execute pack
code — there is no install hook, no lifecycle script, no plugin entry point —
but a malicious pack can still write a `.feature` file, an ADR, or a CI config
your pipeline then runs.

Treat installing a pack the way you treat adding a dependency: from a source
you trust, at a version you pinned.

## Pinning and integrity

Every installed pack is recorded in `.specops.lock` with its repository,
version and a **content digest**: a `sha256` over the pack's file tree, taken
from sorted POSIX-relative paths and file contents, so it is stable across
operating systems and clone order.

Re-installing the same `(repo, pack, version)` recomputes the digest and fails
loudly when it differs:

```
Pack integrity check failed for payments@v1.2.0:
  locked digest:  sha256:9f2c…
  fetched digest: sha256:41ab…
```

That is the signature of a **moved tag**, a rewritten history, or a poisoned
cache — the three ways a version number stops meaning one thing. A version tag
is a label, not a promise; the digest is the promise.

The fix is deliberately manual. Investigate the pack repository first. If the
change is legitimate, re-pin to a new version, or delete the cached copy and
re-run `specops add` to accept the new digest explicitly. Nothing auto-heals,
because auto-healing here means silently accepting substituted content.

## Drift in the other direction

The digest catches the pack changing under a fixed version. `validate
--against-lock` catches the opposite: rendered files in your repository no
longer matching the locked pack.

```bash
specgate validate . --against-lock
```

`specgate ci init` now emits this step for all four providers, guarded on
`.specops.lock` existing so a project without packs is unaffected. If you
generated your gate before this existed, re-run `ci init --stdout` and copy the
`Check pack drift` step across.

## Signed packs

Signature verification uses GPG through git — `git verify-tag`, falling back to
`git verify-commit` for workflows without annotated tags. No new dependency:
organisations that sign already distribute keys through git tooling.

It is **opt-in**, per project:

```yaml
# specops.config.yaml
require_signed_packs: true
```

With that set, an unsigned or unverifiable pack is a hard error.

**It is off by default, and that is deliberate.** Turning it on by default
would break every project installing a pack whose tags are not signed —
including the eighteen packs in this repository (seven proven, eleven starter examples). A default that fails on
correct usage teaches people to disable the check, which is worse than not
having it. Turn it on once your organisation signs its own packs; that is when
the check starts distinguishing anything.

## Air-gapped and offline networks

Two independent mechanisms, for two different situations.

**A machine that has the pack cached already.** Packs are cached under
`~/.cache/specgate/packs/<sha256-of-repo>/<version>/`;
`specops add --cache-dir <path>` points somewhere else.
Setting `SPECGATE_OFFLINE=1` makes resolution use the cache and refuse to reach the
network:

```bash
SPECGATE_OFFLINE=1 specgate specops add --pack-repo <url> --pack-version v1.2.0 --pack payments
```

A cache miss is an error naming the exact directory it looked in, rather than a
silent fetch. Use this on CI runners that must not egress.

**A network that has never seen the pack.** Export the pack repository as a git
bundle on a connected machine, carry the single file across, and install from
it — `specops add` accepts a bundle path anywhere it accepts a URL:

```bash
# connected side
specgate pack bundle --repo https://github.com/acme/packs.git --out acme-packs.bundle

# air-gapped side
specgate specops add --pack-repo ./acme-packs.bundle --pack-version v1.2.0 --pack payments
```

The bundle carries full history and tags, so version pinning, digests and
signature verification all still work. Nothing about the security model is
weakened by the transport.

Both paths are worth rehearsing before you need them. A restore procedure that
has never been run is a hope, not a procedure.

## Scanners for your code

The [quality checks](quality.md) scan your dependencies (osv-scanner), your
code (Semgrep, SpotBugs, SonarQube) and your history for secrets (gitleaks),
each in its official image, pinned. A check takes environment variable
**names** only: a value written into `harness.config.yaml` is refused, so a
token never lands in the repository. SonarQube's token is kept in
`.specgate/sonar.local`, which Specgate adds to `.gitignore`.

## Credentials for Jira and GitHub

Most commands never touch a credential. The ones that talk to Jira, Azure
Boards or GitHub do, and all of them follow the same rules:

| Command | Reaches | Credential |
| --- | --- | --- |
| `specgate propose --from-ticket <KEY>` | Jira: reads one issue | the variable `token_env` names (and `user_env` for the account email) |
| `specgate alm sync`, `alm pull` | Your tracker (Jira, Azure Boards, GitHub Issues): `pull` reads issues, `sync` also creates and closes them | the variable `token_env` names |
| `specgate alm pr <change-id>` | git push to your remote; the GitHub API | your normal git credentials for the push; the variable `pr.token_env` names for the API |

- **Tokens live in the environment, never in a file.** `alm.config.yaml` is
  committed, so it holds only the *names* of environment variables
  (`token_env: JIRA_TOKEN`), never their values. Keep the values in your
  environment or your system's keychain, and in CI as masked secrets.
- **Credentials only travel over https.** `base_url`, and `pr.base_url` for a
  GitHub Enterprise server, must be `https://` addresses; Specgate refuses a
  plain `http://` address, because the token would travel in clear text. Only
  a server on your own machine (`localhost`) may use `http://`.
- **Reading a ticket writes nothing to Jira.** `--from-ticket` reads one issue
  at a time, only keys of `project_key`. A Jira token created with scopes needs
  only `read:jira-work`, and works through Atlassian's gateway
  (`cloud_id: auto`).
- **Give `alm pr` a narrow GitHub token.** Use a fine-grained token for the one
  repository, with Pull requests set to read and write. Do not reuse a broad
  personal token, such as the one your GitHub CLI holds.
- **`alm pr` pushes a branch.** It pushes the ticket's branch to `origin` with
  your git credentials, then opens or updates one pull request. It never
  merges. With `--no-push` it skips the push, for a branch you pushed yourself.

Setup for each mode: [From a Jira ticket](from-a-ticket.md) and
[Jira and Azure Boards](alm.md).

## Dependencies of this tool

The published package has **zero runtime dependencies**. Everything in
`package.json` is a devDependency, so nothing in the dependency tree ships to
users.

That is not the same as harmless. A compromised devDependency executes on CI
with a publish token in scope, which is why the repository's workflows run
`npm audit` and CodeQL, Dependabot watches the tree, and npm releases carry
[provenance](https://docs.npmjs.com/generating-provenance-statements).

### SBOM

A CycloneDX SBOM is generated on every push, pull
request and weekly schedule, and retained for 90 days as the `sbom-cyclonedx`
artifact — so an audit can ask "what was in the tree that day" without
reconstructing a historical dependency graph. Locally:

```bash
npm run sbom        # writes sbom.cyclonedx.json
npm run licenses    # SBOM + the licence policy gate
```

It comes from `npm sbom`, not a third-party generator. Adding a dependency to
document having few dependencies would be a poor trade.

### Licence policy

`scripts/license_check.ts` fails the build when any component carries a licence
outside an allow-list of permissive terms. Dual licences (`MIT OR CC0-1.0`)
pass when either side is allowed; `AND` expressions require every term.

The tree when this table was last counted — 377 components, all permissive, no
copyleft. `npm run licenses` prints the current count:

| Licence | Components |
| --- | --: |
| MIT | 288 |
| Apache-2.0 | 33 |
| ISC | 27 |
| BSD-3-Clause | 9 |
| BSD-2-Clause | 7 |
| BlueOak-1.0.0 | 5 |
| MIT OR CC0-1.0 | 3 |
| Python-2.0 · CC-BY-4.0 · CC-BY-3.0 · CC0-1.0 · 0BSD | 1 each |

The unusual four are worth naming, because "we allow CC-BY" reads alarming
without them: `argparse` is Python-2.0, `caniuse-lite` is CC-BY-4.0 over a
browser-support **dataset**, and `spdx-exceptions` / `spdx-license-ids` are
CC-BY-3.0 and CC0-1.0 over lists of licence identifiers. All four are data or
tooling, none imposes an obligation on distributing this CLI.

A copyleft licence is not banned so much as undecided: allowing one silently
would skip the review of what it obliges. If you need to add a licence, add it
to `ALLOWED` in `scripts/license_check.ts` and say why here — the allow-list and
its justification stay in the same change.

## What this does not do

`specgate validate` is a specification gate, not a security scanner. It checks that
requirements have scenarios, tests and traceability rows. It will not tell you
your application has an injection flaw, and it never claims to.

## Next

- [From a Jira ticket](from-a-ticket.md)
- [Domain packs](domain-packs.md)
