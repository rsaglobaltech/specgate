# Jira, Azure Boards and GitHub

This page is the reference for connecting Specgate to a work tracker (an ALM:
Jira, Azure Boards or GitHub Issues) and to GitHub pull requests. It covers
the two ways to connect Jira, every key of `alm.config.yaml`, and the
`specgate alm` commands. For a step-by-step setup with Jira, read
[From a Jira ticket](from-a-ticket.md) first.

## Two ways to connect Jira — pick one

|                     | The ticket as source                                | The mirror                                                                   |
| ------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Where work starts   | A story in Jira, with acceptance criteria           | A requirement in the spec                                                    |
| What Specgate does  | **Reads** one ticket at a time                      | **Writes**: creates an issue per requirement, closes it                      |
| Commands            | `specgate propose --from-ticket`, `specgate alm pr` | `specgate alm sync`, `specgate alm pull`                                     |
| How the board moves | Jira Automation, from branches and pull requests    | `alm sync` closes an issue when its requirement is done                      |
| Jira token scope    | `read:jira-work`                                    | `read:jira-work` and `write:jira-work`                                       |
| Guide               | [From a Jira ticket](from-a-ticket.md)              | This page, from [Mirror the requirements](#mirror-the-requirements-alm-sync) |

Pick one per project. Using both gives each story a second set of issues: the
ones `alm sync` creates for its requirements.

**The ticket as source** suits a team whose analysts already write stories with
acceptance criteria. `specgate propose --from-ticket` reads the description,
the criteria and the open questions, checks them against a Definition of Ready,
and opens a change whose draft is checked against those criteria.

**The mirror** suits a team that writes requirements in the spec first and
wants the board to reflect them. The spec and the traceability matrix stay the
contract: an issue reflects a requirement, it never defines one
([ADR-0021](specs/adr/0021-alm-is-a-mirror.md)).

## The configuration file

`alm.config.yaml` sits at the project root. **Tokens never go in this file**:
it names the environment variable that holds each one, so the file is safe to
commit and CI supplies the secret.

```yaml
alm_version: 1
provider: jira # jira | azure | github | npm:<package>
base_url: https://acme.atlassian.net
project_key: HIE
token_env: JIRA_TOKEN
user_env: JIRA_USER
cloud_id: auto
```

Which keys a provider reads is the provider's own declaration:

<!-- specgate:alm-provider-table — checked by tests/unit/alm-conformance.test.ts -->

| Provider | Required                               | Optional                                                          |
| -------- | -------------------------------------- | ----------------------------------------------------------------- |
| `jira`   | `base_url`, `project_key`, `token_env` | `user_env`, `issue_type`, `cloud_id`, `acceptance_field`, `epics` |
| `azure`  | `base_url`, `project_key`, `token_env` | `issue_type`, `done_state`                                        |
| `github` | `repo`, `token_env`                    | `base_url`                                                        |

`alm_version`, `provider` and `pr` are read for every provider. A key the
configured provider does not read is reported as `alm_config_unread_key`, with
the provider that would have read it.

### Every key

| Key                | Provider    | What it holds                                                                         |
| ------------------ | ----------- | ------------------------------------------------------------------------------------- |
| `alm_version`      | all         | The file format: `1`                                                                  |
| `provider`         | all         | `jira`, `azure`, `github`, or `npm:<package>` for a community provider                |
| `base_url`         | jira        | The site: `https://your-site.atlassian.net`                                           |
|                    | azure       | The organisation: `https://dev.azure.com/<org>`                                       |
|                    | github      | Only for GitHub Enterprise Server: its API URL                                        |
| `project_key`      | jira        | The project key, `KAN`. Only issues of this project are read                          |
|                    | azure       | The project name                                                                      |
| `repo`             | github      | `owner/name`                                                                          |
| `token_env`        | all         | The name of the variable holding the API token                                        |
| `user_env`         | jira        | The name of the variable holding the account's email (default `JIRA_USER`)            |
| `cloud_id`         | jira        | `auto`, or the site id: route requests through Atlassian's gateway                    |
| `issue_type`       | jira, azure | The type `alm sync` creates (default `Task`)                                          |
| `done_state`       | azure       | The state `alm sync` closes to (default `Done`)                                       |
| `acceptance_field` | jira        | The field that holds acceptance criteria, `customfield_10050`, if not the description |
| `epics`            | jira        | A map from epic key to capability: `KAN-5: entry-exit`                                |
| `pr`               | all         | The block for `specgate alm pr`, below                                                |

Every URL must use `https` (plain `http` only for `localhost`), because the
token is sent to it.

**`cloud_id`.** A Jira token created _with scopes_, the kind Atlassian offers
first, is refused by the site itself: Jira answers it as an anonymous request,
so a search returns nothing instead of an error. Such a token works only
through Atlassian's gateway, `https://api.atlassian.com/ex/jira/<cloud id>`.
`cloud_id: auto` reads the id from the site without sending the token there;
links to issues keep `base_url`. A 401 from the site names this fix.

**`done_state` is Azure-only.** Jira workflows differ per project, so "done"
there is a status _category_, and closing means finding a transition into it.

**`acceptance_field` and `epics`** serve only `propose --from-ticket`. A story
whose epic is not in `epics:` needs `--capability <name>`.

### The `pr:` block

| Key         | Default                  | What it holds                                            |
| ----------- | ------------------------ | -------------------------------------------------------- |
| `provider`  | `github`                 | The only one supported                                   |
| `repo`      | (required)               | `owner/name`                                             |
| `base`      | `develop`                | The branch pull requests target                          |
| `token_env` | `GITHUB_TOKEN`           | The name of the variable holding the GitHub token        |
| `base_url`  | `https://api.github.com` | The API URL; change it only for GitHub Enterprise Server |

The token in `pr.token_env` should be a fine-grained token for this one
repository, with Pull requests read and write. Do not use a broad personal
token such as the one `gh auth token` prints. Pushing uses your normal git
credentials, not this token.

## Open a ticket's pull request: `alm pr`

```bash
specgate alm pr kan-13-register-vehicle-entry
specgate alm pr kan-13-register-vehicle-entry --no-check
```

For a change opened with `--from-ticket`, open or archived, on the ticket's
branch, `alm pr` pushes the branch and opens one pull request against
`pr.base`, titled with the key and the ticket's summary. The body links the
ticket and the change, lists each requirement with its status, and states
whether `specgate check` passes; `--no-check` skips the check and says so.
`--no-push` skips the push.

Run it again to update the same pull request: it rewrites only its own block of
the description and keeps a title a person edited, as long as the title still
names the key. It refuses on another branch or with uncommitted changes, and it
never merges, closes or deletes anything. The full loop is in
[From a Jira ticket](from-a-ticket.md#the-daily-loop-per-ticket).

## Mirror the requirements: `alm sync`

```bash
export JIRA_TOKEN=…  JIRA_USER=…
specgate alm sync --dry-run        # the plan only: nothing is created or closed
specgate alm sync                  # do it, and write .specops/alm-map.json
specgate alm status                # the requirement ↔ issue mapping, no network
specgate alm link REQ-007 HIE-42   # adopt an issue that already exists
```

`alm sync` creates an issue for every requirement without one, closes the issue
when its requirement reaches a done status, and reports **drift**: an issue
closed while its requirement is still open. It never resolves drift for you and
never reopens a requirement; a person settles it.

`.specops/alm-map.json` is the mapping and **belongs in git**. It is what makes
`sync` safe to run twice, and what lets another machine continue. `sync` exits 1
when it finds drift, so it works as a scheduled CI job.

**On GitHub, closed is not always done.** GitHub records why an issue was
closed. Only **completed** reads as done; **not planned** leaves the
requirement open and shows up as drift, because the work was dropped, not
delivered.

## Bring issues in: `alm pull`

```bash
specgate alm pull --label spec-driven            # one change per labelled issue
specgate alm pull --label spec-driven --dry-run  # see what it would open
```

Each open issue with the label becomes a change,
`docs/specs/changes/alm-<key>/`, with a proposal quoting the issue word for word
and a delta holding one requirement. `alm pull` reads only the title and the
description, so **it leaves the scenario unwritten**, and the change does not
validate until someone writes it. That is deliberate: generating Given/When/Then
from free prose would invent the one thing the spec exists to pin down.

When the issue is a Jira story with acceptance criteria, use
`specgate propose --from-ticket <KEY>` instead: it reads the criteria and
checks the draft against them.

Pulling twice is safe: a change that already exists is skipped. Azure cannot
search by label (it searches with WIQL), so `alm pull` says so on Azure instead
of failing.

## Providers: three core, more from the community

`jira`, `azure` and `github` are **core**: maintained in this repository and
tested against recorded responses on every CI run. Any other tracker can be
added as a package:

```yaml
provider: npm:specgate-alm-youtrack
```

```bash
npm install --save-dev specgate-alm-youtrack   # you install it; specgate never does
```

**A community provider is code that runs in your process, and it receives your
tracker's token.** Treat it like any devDependency: read it, pin it, review its
updates. Specgate never installs it for you, accepts only a package name (no
path or URL), and checks the module against the provider contract before
calling it.

### Writing a provider

Export an object that satisfies `AlmProvider`: `id`, `label`, `config` (the
keys it requires and reads), `capabilities`, and a `create(cfg, fetchImpl)`
factory. Taking `fetchImpl` lets the conformance tests run the provider against
recorded responses with no network. Declare capabilities honestly:
`listIssues: false` is a valid answer and makes `alm pull` explain itself
instead of failing. `scripts/alm/port.ts` documents every field.

To add a core provider, put one module under `scripts/alm/providers/`, register
it in that folder's `index.ts`, and add a recorded fixture in
`tests/fixtures/alm/<id>.json`. `tests/unit/alm-conformance.test.ts` then runs
the same suite against it as against the three core providers.

## Next

- [From a Jira ticket](from-a-ticket.md)
- [Automation](automation.md)
