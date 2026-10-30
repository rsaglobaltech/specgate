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
project, without the prefix they share: `truck-flote-fleet` is `fleet`, its path
kept (REQ-348). A name ending in `contracts` gets the role `contracts`, one
ending in `web` the role `web`, the rest `service`. Name them yourself otherwise:

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
| `workspace_dependency_pending` | A requirement depends on another repository's that is not delivered; a warning while the requirement is itself in an open change, since the story harness builds in that order (REQ-396) |
| `workspace_story_diverged` | A warning: a sub-change's criteria are not the story's (REQ-343) |
| `workspace_api_unresolved` | `api=<repo>:<file>#<operationId>` names no operation of that repository's contracts; a warning until the requirement is delivered (REQ-405) |
| `contract_operation_not_found` | A warning: a delivered requirement cites an HTTP operation whose path no source file of its repository serves or calls (REQ-408) |

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

## From the client's brief to stories

Save the client's brief as `brief.md` in the workspace repository. `specgate
status` there says what comes next (REQ-341).

```bash
specgate workspace draft
```

The brief goes below a front matter in `docs/brief.md`, its text kept. Name the
business stories it holds, each with the repositories it touches (REQ-339) — or
let an agent propose them, with a `# check:` comment where it is unsure:
`specgate workspace draft --agent "claude -p"` writes only the front matter, and
puts back the client's text if it moved (REQ-360).

```yaml
stories:
  - { id: follow-shipment, title: El cliente sigue su envío, repos: [fleet, tracking, web] }
```

```bash
specgate workspace draft                                       # lists them
specgate workspace draft follow-shipment --agent "claude -p"   # REQ-340
```

The agent reads the brief and writes the story's `docs/stories/follow-shipment/story.md`:
its **Intent**, its **Acceptance criteria** (`AC-1`, `AC-2`…) and, under
**Repositories**, the criteria each repository answers (`- fleet: AC-1, AC-2`,
REQ-361); the form's hints go once it has written (REQ-364). What only the client
can decide goes in `questions.md`, a row each, with an `Answer` column (REQ-363).
Anything it writes elsewhere is undone. Without `--agent`, the files wait with
their sections. Review them: this is the business story every repository answers.

## A story across repositories

```bash
specgate workspace propose follow-shipment
```

- Each repository the brief names (or `--repos fleet,tracking,web`) gets the
  change `follow-shipment`. Its `discover.md` holds the story's intent and
  criteria, copied as the story states them, and names the story
  `truck-flote:follow-shipment` (REQ-342).
- It refuses while a question in `questions.md` has no answer, naming it;
  `--allow-open-questions` proposes anyway (REQ-363).
- The Discover names the story's other repositories, and — when the story maps
  its criteria — the ones this repository answers and the others' (REQ-361).
  How a requirement says what it needs from them, `depends=fleet:REQ-NNN` and an
  `api=` operation of the contracts repository, is in the sub-change's
  `design.md`: the Discover stays business (REQ-344, REQ-365).
- `story.json` in the sub-change names the workspace, so `change author` tells
  the agent writing any layer of it the story's other parts (REQ-366).
- The contracts repository's agent is asked to write the OpenAPI or AsyncAPI file
  under `contracts/` and cite each operation as `api=`; the others, to cite it with
  `depends=`. A `depends=` or `api=` the design names and no trace carries is a
  `layer_design_dependency_untraced` warning: the gate reads the traces (REQ-380..382).
- Write the contracts part first. `change author` refuses the specs, design or
  tasks of a part that shares a criterion with the contracts repository while the
  contracts' part specifies nothing (`author_contracts_first`; `--force` writes it
  anyway): a part written beside an empty contract designs an API of its own (REQ-395).
- Cite the operation, not only the requirement that wrote it. A service or web
  requirement that serves or calls the contract carries both in its trace:
  `depends=contracts:REQ-002 api=contracts:contracts/fleet.openapi.yaml#getFleetStatus`
  — the repository's name before the file, as in a qualified id. Its own
  `validate` leaves that citation to `workspace check`, which resolves it in the
  contracts repository (REQ-405). The story's context lists, under each requirement
  of the contracts, the exact `depends=… api=…` line to copy, with the operation's
  method and path (REQ-415). `change validate` fails with `layer_no_operation_cited`
  for a `depends=` on the contracts with no `api=` once that requirement cites an
  operation (REQ-406), and with `layer_api_unresolved` for an `api=` of the
  contracts repository that names none of its operations, listing those it has;
  `change approve` refuses both (REQ-415). The harness prompt quotes each cited
  operation as the contract writes it, and says to serve or call exactly that
  method and path (REQ-407).
- Once a requirement is delivered, `workspace check` and `contract check` warn
  `contract_operation_not_found` when no source file of its repository — tests,
  `contracts/`, `docs/` and `features/` aside — has the operation's path; a
  parameter may be written `{id}`, `:id`, `[id]`, `<id>` or `${…}`, and anything may
  come before the path. A route mounted in two pieces is not seen, so it is a
  warning (REQ-408). The harness is stricter: an attempt whose requirement cites
  another repository's operation fails after a green gate while no source file
  has its path, whole or in pieces — a prefix on the class, the rest on the
  method — and the next attempt is told the method and path (REQ-418).
- The criteria are the business's: `workspace check` warns when a repository's
  differ from the story's (REQ-343), and when a criterion is answered by no
  repository or claimed by two (REQ-362). Change them in the story.

Each repository then works its change as usual — draft, review, harness,
archive. `workspace status` shows each sub-change open, archived or missing,
and the story **done only when every repository has archived its part**.

## Build a story, and watch it

```bash
specgate workspace harness run --story follow-shipment
specgate workspace live          # the studio, serving the workspace's /live
```

- `workspace harness run --story` starts one `harness run` per repository that
  holds an open part of the story, for that part's requirements, each its own
  process, its output in `.specgate/workspace-runs/<story>/` (git-ignored). A
  repository whose part depends on another part's undelivered requirement starts
  once that repository has finished; the rest run at once (REQ-345). Even then,
  only its requirements whose dependencies are delivered start: the others are
  named, waiting, and the run exits 1 (REQ-367). The
  options after a bare `--` go to every repository's harness. `--dry-run` prints
  the commands with their order.
- Each harness is told the story's other parts and their requirements, so its
  agent can name what it waits for (REQ-344).
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
- Each repository's name opens its own live view at `/live/repo/<name>/` —
  the work queue, the agent's console, each attempt and the gate step, the same
  page that repository's studio serves at `/live` — kept current as its harness
  writes, with its role and a link back to the workspace. It reads: answer a
  question from that repository's studio. A repository the workspace does not
  have, or whose folder is missing, is a 404 saying so (REQ-410..412).
## The organization's principles

`docs/specs/principles.md` holds the principles a repository follows, with
`principles_version` and `source` in its front matter. In a workspace the source
is the workspace repository's copy (`source: ../ws/principles.md`); shared as a
domain pack whose `outputs.files` writes the file, it is `source: pack:<pack_id>`.
`specgate check` names the version and warns `principles_behind` when the source
has a newer one (REQ-330, REQ-332). A principle can carry a check the gate runs:

```markdown
## P1 — No credentials in code
<!-- specgate:principle forbid="password\s*=\s*\"" in="src/**" -->

## P2 — Dependencies audited
<!-- specgate:principle run="npm audit --omit=dev" level=warn -->
```

A failure is `principle_failed`, which fails the gate; `level=warn` makes it
advice (REQ-331).

A requirement that shares a criterion with the contracts repository cites it: `change validate` warns
`layer_no_contract_cited` when it carries neither `depends=contracts:REQ-NNN` nor an `api=` (REQ-386), and
a citation of a contract file not written yet is a warning until the requirement is delivered (REQ-385).

## What a workspace does not do

- It never writes a repository's specification. It asks each repository through
  the CLI, so it sees what that repository's own gate sees.
- A repository outside a workspace works exactly as before.
- `workspace check` runs the repositories one after another.

## Next

- [The harness](harness.md) — deliver each repository's requirements.
- [Specgate at enterprise scale](specs/enterprise-sdd-gap.md) — what the 1.0
  line adds on top of the workspace.
