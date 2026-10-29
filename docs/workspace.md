# A workspace of repositories

A product made of several repositories — a fleet service, a tracking service, a
web app, a repository of shared contracts — gets one place that knows them all:
a **workspace repository** holding `specgate.workspace.yaml`. Each repository
keeps its own specification and its own gate; the workspace answers what none of
them can alone:

- where the whole product stands,
- one gate across every repository,
- a requirement of one repository that waits for another's,
- a business story split into a change in each repository it touches.

The model is [ADR-0041](specs/adr/0041-the-workspace.md).

## Ids across repositories

Inside a repository a requirement keeps its id: `REQ-012`. Across the workspace
every repository has a `REQ-012`, so a requirement is named with its repository:
`tracking:REQ-012`. Write the qualified form wherever one repository speaks of
another's requirement — in a spec's prose, in a workspace story, in `depends=`.

## Set it up

Put the workspace repository beside its members:

```
truck-flote-workspace/     ← the workspace
truck-flote-fleet/
truck-flote-tracking/
truck-flote-web/
truck-flote-contracts/
```

```bash
cd truck-flote-workspace
specgate workspace init --name truck-flote
```

Without `--repo`, `init` names every sibling folder that holds a Specgate
project. A name ending in `contracts` gets the role `contracts`, one ending in
`web` the role `web`, the rest `service`. Name them yourself otherwise:

```bash
specgate workspace init --name truck-flote \
  --repo fleet=../truck-flote-fleet \
  --repo tracking=../truck-flote-tracking \
  --repo web=../truck-flote-web:web \
  --repo contracts=../truck-flote-contracts:contracts
```

The file it writes:

```yaml
workspace_version: 1
name: truck-flote
repos:
  - name: tracking
    path: ../truck-flote-tracking
    url: https://github.com/acme/truck-flote-tracking.git
    role: service
    capabilities: [tracking, telemetry]
```

| Key | What it is |
| --- | --- |
| `name` | What ids are qualified with: `tracking` in `tracking:REQ-012`. Lower-case letters, digits and dashes |
| `path` | The repository's folder, relative to the workspace |
| `url` | Where to clone it from, when it is not there (optional) |
| `role` | `service`, `web`, `library` or `contracts` |
| `capabilities` | Its `docs/specs/capabilities/*`, as `init` found them |

## Where the product stands

```bash
specgate workspace status
```

Each repository: its role, its requirements done of its total (as its own
`specgate status` counts them), its branch and its gate as the last `workspace
check` left it — passed, failed or not run. Then each story.

`--json` gives the model the workspace live view and other tools build on; its
shape is in ADR-0041.

## One gate across the repositories

```bash
specgate workspace check
```

It runs `specgate check` in each repository, then what only the workspace can
judge, and exits non-zero when anything fails:

| Code | What fails |
| --- | --- |
| `workspace_repo_gate` | A repository's own `specgate check` |
| `workspace_repo_missing` | A repository is not at its path (`url` says from where to clone it) |
| `workspace_unknown_repo` | A qualified id names a repository the workspace does not have |
| `workspace_unknown_requirement` | A qualified id names a requirement its repository does not have |
| `workspace_dependency_pending` | A requirement depends on another repository's that is not delivered |

The result is kept in `.specgate/workspace-check.json` (git-ignored), which
`status` reads.

## A requirement that depends on another repository

The tracking service shows the client a shipment's position through an
operation the contracts repository specifies. In tracking's capability spec:

```markdown
<!-- specgate:trace actor=Cliente kind=functional depends=contracts:REQ-004 -->
```

Tracking's own `validate` leaves `contracts:REQ-004` to the workspace — it is
neither an unknown dependency nor part of tracking's own order. `workspace
check` fails until `contracts:REQ-004` is Implemented, Verified or Released in
contracts:

```
✖  tracking:REQ-005 depends on contracts:REQ-004, which is Draft, not delivered.
   fix: Deliver REQ-004 in contracts first (specgate harness run --req REQ-004 there).
```

## A story across repositories

The business asks for one thing — "the client follows their shipment" — and it
takes a change in three repositories:

```bash
specgate workspace propose follow-shipment \
  --repos fleet,tracking,web --title "El cliente sigue su envío"
```

- Each of the three gets the change `follow-shipment`, its proposal saying it is
  part of the workspace story `truck-flote:follow-shipment`.
- The workspace records the story in `docs/stories/follow-shipment/`:
  `story.md` for the business intent, `story.yaml` for its sub-changes.

Each repository then works its change as usual — draft, review, harness,
archive. `workspace status` shows each sub-change open, archived or missing,
and the story **done only when every repository has archived its part**.

## Build a story, and watch it

```bash
specgate workspace harness run --story follow-shipment
specgate workspace live          # the studio, serving the workspace's /live
```

- `workspace harness run --story` starts one `harness run` per repository that
  holds an open part of the story, for that part's requirements, **all at once**,
  each its own process, its output in `.specgate/workspace-runs/<story>/`. The
  options after a bare `--` go to every repository's harness. `--dry-run` prints the
  commands.
- It starts **none** when a repository's base already fails the gate on
  requirements outside its part, as each harness would refuse on its own
  (REQ-175) — said once, naming the repository, before anything is paid for.
- `specgate studio` started in the workspace repository serves the workspace's
  live view at `/live`: a panel per repository with the requirement in flight,
  the gate step it is on and since when, and its agent's last step; each story
  with its parts open, building, archived or missing, and the parts waiting on
  another repository's undelivered requirement named; and what each repository
  and each story has cost, in money and minutes.
- `/live.json` and `workspace live --json` give that model as data
  (REQ-320..324).

## What a workspace does not do

- It never writes a repository's specification. It asks each repository through
  the CLI, so it sees what that repository's own gate sees.
- A repository outside a workspace works exactly as before.
- `workspace check` runs the repositories one after another.

## Next

- [The harness](harness.md) — deliver each repository's requirements.
- [Specgate at enterprise scale](specs/enterprise-sdd-gap.md) — what the 1.0
  line adds on top of the workspace.
