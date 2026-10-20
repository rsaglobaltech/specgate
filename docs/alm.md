# Jira and Azure Boards

**Goal:** every requirement in the matrix has exactly one issue on the board,
and the two never quietly disagree.

`specgate alm sync` creates an issue for each unlinked `REQ`, closes the issue when
its requirement reaches a done status, and reports **drift** — an issue closed
while its requirement is still open — without resolving it for you.

**The ALM is a mirror, not a source of truth.** The spec and the matrix are the
contract; an issue reflects a requirement, it never defines one. That is why
`sync` closes issues but never reopens requirements, and why drift is reported
rather than reconciled.

## Configure

`alm.config.yaml` at the project root. **Tokens never live in this file** —
only the _name_ of the environment variable that holds them, so the file is
safe to commit and CI supplies the secret.

```yaml
alm_version: 1
provider: jira # jira | azure
base_url: https://acme.atlassian.net
project_key: HIE
token_env: JIRA_TOKEN # env var holding the API token
user_env: JIRA_USER # jira only: env var holding the account email
cloud_id: auto # jira only: for a token created with scopes
```

Which keys a provider reads is the provider's own declaration, and they differ:

<!-- specgate:alm-provider-table — checked by tests/unit/alm-conformance.test.ts -->

| Provider | Required                               | Optional                                                          |
| -------- | -------------------------------------- | ----------------------------------------------------------------- |
| `jira`   | `base_url`, `project_key`, `token_env` | `user_env`, `issue_type`, `cloud_id`, `acceptance_field`, `epics` |
| `azure`  | `base_url`, `project_key`, `token_env` | `issue_type`, `done_state`                                        |
| `github` | `repo`, `token_env`                    | `base_url`                                                        |

Four asymmetries worth knowing, because the first two used to fail silently:

- **`done_state` is Azure-only.** Jira's workflows are per-project, so "done"
  there is a status _category_ and closing means finding a transition into it.
  Setting `done_state` on a Jira project does nothing — and `sync` now says so
  before its first request.
- **`user_env` is Jira-only**, because Jira Cloud's Basic auth pairs the token
  with an account email. It defaults to `JIRA_USER` when omitted.
- **`cloud_id` is Jira-only.** A token created _with scopes_ — the kind
  Atlassian now offers first — is refused by the site itself
  (`AUTHENTICATED_FAILED`) and only works through Atlassian's gateway,
  `https://api.atlassian.com/ex/jira/<cloud id>`. `cloud_id: auto` reads the
  id from the site, without sending the token there; links to issues keep
  `base_url`. A 401 from the site names this fix.
- **GitHub takes `repo`, not `project_key`**, and its `base_url` is optional.
  Its unit is a repository — `repo: acme/widgets` — and github.com has one API
  host, so only GitHub Enterprise Server needs a base URL. It has no
  `issue_type` (GitHub has labels) and no `done_state` (an issue is open or
  closed).

Any key that the configured provider does not read is reported as a warning
with a fix, naming the provider that _would_ have read it.

### Closed is not always done, on GitHub

GitHub records _why_ an issue was closed. Closing as **not planned** means the
team decided against the work; closing as **completed** means it happened. Only
the second reads as `done` here.

Collapsing both would tell `traceability.md` that a requirement was delivered
when it had in fact been abandoned. Instead a not-planned close leaves the
requirement open, and the disagreement shows up as drift for a person to
settle — which is what [ADR-0021](specs/adr/0021-alm-is-a-mirror.md) asks for:
the board is a mirror, and it never advances a requirement on its own.

## Two tiers: core and community

`jira`, `azure` and `github` are **core** — maintained in this repository and
exercised by the conformance kit on every CI run. Anything else is resolved by
package name:

```yaml
# alm.config.yaml
provider: npm:specgate-alm-youtrack
```

```bash
npm install --save-dev specgate-alm-youtrack   # you install it; specgate never does
```

The split is not a preference. Every connector is somebody else's API, changing
on their schedule: carrying six here would tie this repository's release cadence
to six vendors, and carrying none would make the tool useless to a team on
YouTrack. So the port is the contract, and anyone can implement it.

### What you are agreeing to

**A community provider is code that runs in your process, and it is handed your
ALM credential** — a connector cannot talk to a board without one. The trust
model is exactly that of a devDependency, and it deserves the same scrutiny:
read it, pin it, and treat an update like any other dependency update.

Three things the CLI does so that it is no _worse_ than a devDependency:

- **Nothing is ever installed automatically.** The package must already be in
  your `node_modules`. Editing a config file can never fetch and run new code —
  adding a provider stays a dependency decision, made deliberately.
- **The name must be a package name.** No paths, no URLs, no `..`. A committed
  config file cannot be made to load an arbitrary file from your disk.
- **The module is checked against the port before anything is called.** A
  package that is not a provider, or one that claims a capability it has no
  method for, fails with a diagnostic naming the problem — not with a stack
  trace from inside `sync`, halfway through a run.

### Writing one

Export an object satisfying `AlmProvider` — `id`, `label`, `config`,
`capabilities` and a `create(cfg, fetchImpl)` factory. Taking `fetchImpl` is
what lets the conformance kit exercise a provider against recorded responses,
with no network; the three core providers are worth reading as examples, and
`scripts/alm/port.ts` documents every field and why it exists.

Declare capabilities honestly. `capabilities.listIssues: false` is a supported
answer — `azure` gives it — and it makes `alm pull` degrade with a message
rather than fail at the first request.

## Bringing work in: `alm pull`

The request every team makes after seeing `sync` is the other direction — _the
product owner opens the ticket, make it appear in the repo_. It does, as a
**change**, never as a matrix row:

```bash
specgate alm pull --label spec-driven            # one change per labelled issue
specgate alm pull --label spec-driven --dry-run  # see what it would open
```

Each pulled issue becomes `docs/specs/changes/alm-<key>/` with a proposal
quoting the issue verbatim — not summarised, so a reviewer reads the reporter's
words and not this tool's paraphrase — and a delta carrying one requirement.

**The scenario is left unwritten, and `change validate` refuses the change until
you write it.** That is the design, not a gap. A ticket has a title, a
description and a status; it has no executable acceptance criterion. Generating
Gherkin from prose would invent the one thing the spec exists to pin down, and
the gate would then be checking fiction. The empty scenario marks the only work
that cannot be automated — yours, or the `spec-author` role's via
[`specgate change author`](reviewing-changes.md).

Pulling twice is safe: a change that already exists is skipped, so edits you
have started are never overwritten.

**Searching is a declared capability.** `github` and `jira` can filter by label;
`azure` cannot, because Azure searches with WIQL — a different shape entirely —
and says so rather than failing at the first request.

## Run

```bash
export JIRA_TOKEN=…  JIRA_USER=…
specgate alm sync --dry-run     # plan only: no issue is created or closed
specgate alm sync               # do it, and write .specops/alm-map.json
specgate alm status             # the REQ ↔ issue mapping, no network
specgate alm link REQ-007 HIE-42   # adopt an issue that already exists
```

`.specops/alm-map.json` is the mapping and **belongs in git**: it is what makes
`sync` idempotent, and what lets a second machine pick up where the first left
off. `sync` exits 1 when it finds drift, so it works as a scheduled CI job.

## Adding a provider

A provider is one module under `scripts/alm/providers/` plus a row in that
directory's `index.ts`. It declares which config keys it reads and which
operations it supports, and implements three methods — `createIssue`,
`getIssueStatus`, `closeIssue`. `tests/unit/alm-conformance.test.ts` then runs
the same suite against it as against the two that ship, from a recorded fixture
in `tests/fixtures/alm/<id>.json`; a registered provider without one fails.

---

## Next

- [Automation](automation.md)
- [Command reference](commands.md)
