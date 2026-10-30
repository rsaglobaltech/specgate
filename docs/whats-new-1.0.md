# What is new in 1.0

Specgate 1.0 is for a product made of several repositories and built by several
roles. Its candidates (`1.0.0-rc.N`) are published under the npm dist-tag `next`;
`npm install` keeps giving 0.27 until 1.0 is released.

```bash
npm i -D @rsaglobaltech/specgate@next --prefer-online   # the latest candidate
npx specgate --version
```

A 0.27 project moves with one command, `specgate migrate 1.0`: what breaks, what
it does about each, and how to stay on 0.27 are in
[Migrating to 1.0](migrating-to-1.0.md). This page shows what 1.0 adds, feature
by feature, and then what each candidate changed.

## A change in three layers, each with its owner

A 0.27 change was a proposal and a delta. A 1.0 change has three layers, each
written and approved by the role that owns it
([ADR-0042](specs/adr/0042-the-three-layers-of-a-change.md)):

| Layer | File | Owner | Says |
|---|---|---|---|
| Discover | `discover.md` | product | context, use case, acceptance criteria `- AC-1: …` — no technology |
| Design | `design.md` | architect | modules, mechanisms, decisions; answers every criterion |
| Tasks | `tasks.md` | developer | verifiable tasks, each naming its requirement |

The delta under `specs/` is still the contract the gate judges.

```bash
specgate change new follow-shipment          # writes the three layers
specgate change status follow-shipment       # "Write discover.md (product)" …
specgate change validate follow-shipment     # the layer rules, below
```

`change validate` warns when the Discover names a technology, when the design
leaves a criterion unanswered, when a task names no requirement, and when the
Discover moved away from the version that was agreed; `--strict` fails on them.
It also fails with `change_not_approvable` for anything approval would refuse.

`specgate change author <id> --artifact discover|specs|design|tasks` has an agent
write one layer, with the rules of that layer and, in a workspace, the whole story
in its prompt.

## Roles and approvals gate the harness

`roles:` in `harness.config.yaml` names who holds each role, and each layer is
approved by its owner ([ADR-0043](specs/adr/0043-roles-approvals-and-role-packages.md)):

```bash
specgate change approve follow-shipment --layer discover   # product
specgate change approve follow-shipment --layer design     # architect
specgate change approve follow-shipment --layer tasks      # developer
```

Each approval is kept in the change's `approvals.json` with a hash of the layer.
Editing an approved layer asks for its approval again — ticking a task box does
not. The harness builds a layered change only once every written layer is
approved (`harness_not_approved` otherwise); `approvals: { required: never }`
keeps 0.27's behaviour. The studio's Review shows each layer's approvals and lets
the viewer approve the layer they own.

**Role packages.** `harness/<role>.md`, with `applies-to` by kind, capability or
tag, reaches the prompt of the requirements it concerns under "Role constraints",
and the run record, the live view and `harness report` name it as `role@version`.

## A workspace of repositories

A **workspace repository** holds `specgate.workspace.yaml`, naming the
repositories of one product and their roles — `service`, `web`, `contracts`
([Workspace](workspace.md), [ADR-0041](specs/adr/0041-the-workspace.md)).

```bash
specgate workspace init --name truck-flote     # finds the sibling repositories
specgate workspace status                      # where the product stands
specgate workspace check                       # every repository's gate at once
```

Across the workspace a requirement is named with its repository,
`tracking:REQ-012`, and a requirement that needs another repository's says so in
its trace:

```markdown
<!-- specgate:trace kind=functional actor=Dispatcher depends=contracts:REQ-002 api=contracts/fleet.openapi.yaml#getFleetStatus -->
```

`workspace check` holds a requirement back until the one it depends on is
delivered (`workspace_dependency_pending`). While the requirement is itself still
in an open change, that is the order the story is built in, so it is a warning.

## A business story, from the client's brief to every repository

The brief is the client's; the story is the business's; each repository gets its
part.

```bash
specgate workspace draft                        # brief.md, below a front matter naming its stories
specgate workspace draft --agent "claude -p"    # an agent proposes the stories
specgate workspace draft track-fleet --agent "claude -p"   # intent and criteria of one story
specgate workspace propose track-fleet          # a change in each repository it touches
```

- A story's `## Repositories` says which criteria each repository answers
  (`- tracking: AC-1, AC-2`); `workspace check` warns about a criterion nobody
  answers or two claim, and when a repository's criteria drift from the story's.
- The story's questions wait in `docs/stories/<id>/questions.md`;
  `workspace propose` refuses while one is open.
- Every sub-change gets the story's intent and criteria in its `discover.md`, and
  `story.json` naming the workspace, so the agent writing any of its layers sees
  the whole story and the other repositories' parts.
- The story is done when every part is archived; its cost counts all of them.

## Contracts first, then the services that use them

A repository with the role `contracts` writes the OpenAPI or AsyncAPI files under
`contracts/`, and each of its requirements cites its operation with
`api=contracts/<file>#<operationId>`. The other repositories cite them:

- `change validate` warns `layer_no_contract_cited` for a requirement of a story
  sharing a criterion with the contracts that cites none of their requirements or
  operations, and `layer_design_dependency_untraced` for a `depends=` or `api=`
  that design.md decides and no trace carries — the harness reads the traces.
- `change author` writes a part that shares a criterion with the contracts only
  after the contracts' part specifies something (`author_contracts_first`;
  `--force` writes it anyway).
- `validate` fails when an `api=` of a delivered requirement does not resolve; a
  requirement not built yet may cite a contract it will write.
- `specgate contract check` lists the operations no requirement cites.

## The story, built in order

```bash
specgate workspace harness run --story track-fleet --dry-run   # the levels
specgate workspace harness run --story track-fleet
```

Every repository's harness starts for its part, by levels: a part that depends on
another repository's requirements starts once that repository has delivered them.
None starts when one repository's base already fails the gate. In the sixth and
seventh runs of truck-flote — three repositories, nine requirements — the
contracts were built at level 1 and the service and the web at level 2, every
requirement at the first attempt.

## The workspace, live

`specgate studio` in the workspace repository serves `/live`, refreshed as it
happens: a panel per repository with the requirement in flight, its gate step and
the agent's last step; each story with its parts open, building, archived or
missing, and the parts waiting on another repository named; the cost per
repository and per story. `specgate workspace live --json` prints the same model.

## The backlog follows the change

`alm sync` moves each change's ticket to the state of its phase — `proposed`,
`building`, `archived` — on Jira, Azure Boards, GitHub and, new in 1.0, Linear.
`alm pull` brings the ticket's comments back as notes in `review.md`, never into
the specification, and a change that lists `repositories:` gets one sub-issue per
repository. `alm phase` and `alm move` say where a change stands and move its
ticket now ([The board follows the change](alm-phases.md)).

## The two gaps

`harness report` says, for each requirement that needed rework, whether the spec
was clear and the code diverged (spec → implementation) or the spec missed part
of the use case (intent → spec), and what to strengthen. A person confirms it:

```bash
specgate harness report --classify REQ-012 --gap intent-spec --reason "the criterion did not say offline"
```

See [Harness report](harness-report.md).

## Principles, drift and a scope to adopt

- **Principles.** `docs/specs/principles.md`, from a file or a domain pack, with
  its version; a principle with `run=` or `forbid=` … `in=` is checked by the
  gate (`principle_failed`), and `principles_behind` says when the source moved.
- **Drift.** `check` warns `spec_drift` for a commit that changes production code
  and names no requirement; `specgate drift` reports it for CI.
- **Adopt one area.** `specgate adopt --scope <path>` specifies one part of a
  large repository.

## Each candidate

Every candidate after the first came out of a run of truck-flote — a product of
three repositories built from its client's brief alone — and fixes what that run
found. The full notes are in the
[CHANGELOG](https://github.com/rsaglobaltech/specgate/blob/next/1.0/CHANGELOG.md).

| Candidate | What it changed |
|---|---|
| 1.0.0-rc.1 | The line: three layers, roles and approvals, the workspace and its live view, the backlog following the phases, the two gaps, principles, drift, API contracts, `specgate migrate 1.0`. A candidate is never `latest`. |
| 1.0.0-rc.2 | The workspace takes the client's brief and drafts its stories; a story's intent and criteria reach every repository; the story is built in dependency order; `init --yes` adopts the folder it is run in. |
| 1.0.0-rc.3 | A tick no longer withdraws an approval; an agent proposes the stories; each criterion names its repositories; questions wait for their answers; the agents see the whole story. |
| 1.0.0-rc.4 | What a design says a requirement waits for reaches its trace; the contracts repository writes its contracts; an agent may tick its own task. |
| 1.0.0-rc.5 | A contract is built one requirement at a time; a part sharing a criterion with the contracts cites them. |
| 1.0.0-rc.6 | The design carries its dependencies into the traces, so the parts are built in order; a placeholder operation is no citation. |
| 1.0.0-rc.7 | A part is written after the contracts it uses; a requirement still being drafted that waits for another repository is the build order, not a failure. |
| 1.0.0-rc.8 | The site carries both versions: this page, and the picker at the top left. |
