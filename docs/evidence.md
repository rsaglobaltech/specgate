# Evidence before and after

At the end of this page each requirement of a change has a before and an
after, and the change has one page that shows them side by side: the last
screenshot of each test, where the videos and traces are, and the flow and the
code drawn as diagrams. The reviewer starts there, and opens the code where
the evidence shows risk ([ADR-0047](specs/adr/0047-evidence-before-and-after.md)).

**You need:** a project with `bdd: required` and a `bdd_cmd` that runs the
scenarios ([Configure the gate](gate/policy.md)). Without it you still get the
diagrams, but no pictures: the scenarios never run.

## Let the runner keep pictures

Specgate does not drive a browser. It keeps what your runner writes under
`test-results/` while it runs a requirement's scenarios — at the root, and in
each workspace your `package.json` declares (`apps/web/test-results/`).
Playwright keeps no screenshot or video unless its config says so:

```ts
// playwright.config.ts
export default defineConfig({
  use: { screenshot: "on", video: "on", trace: "on" },
});
```

`specgate doctor` warns (`doctor_evidence_media`) when any is off. A trace kept
only on failure (`retain-on-failure`) keeps none of the after, which passes.

## The before

Once the test is written, and before the code:

```bash
specgate evidence before REQ-031
```

It runs REQ-031's scenarios (`bdd_cmd` with `@REQ-031`) on the code as it is
and keeps the run in `.specgate/evidence/REQ-031/before/`: `run.json` (the
command, its exit code), `run.log`, and `artifacts/` with what the runner
wrote. Red is expected: on an existing screen the pictures show it as it was;
on a new one, where the flow stopped. `specgate reproduce run` keeps a bug's
red run there too. The agents' `apply` step tells them to take it.

## The after

`specgate apply REQ-031` keeps the after where it always has, in
`.specgate/evidence/REQ-031/`, and `evidence.json` names the before. Every
`artifacts/` folder stays out of git.

## The attempts on the way

When `apply`'s scenarios fail, the run is kept as an attempt:
`.specgate/evidence/REQ-031/attempts/1/`, then `2`, each with its log and what
the runner and the AI log wrote; `apply_bdd_failed` names the folder. The
delivery's `evidence.json` lists them and the page shows them under "Failed
attempts": why each failed, and what the AI decided in it — a flaky scenario
is what a reviewer most needs to see. A new `evidence before` starts again
and removes them.

## The page

```bash
specgate evidence draft-orders
```

It writes `docs/specs/changes/draft-orders/EVIDENCE.md`. Per requirement:

- A table with one row per test: its last screenshot before and after. The
  pictures are copied into `evidence/` beside the page, so they render in the
  pull request; one over 300 KB is named, not copied.
- The paths of the videos and traces, under `.specgate/evidence/`.
- **Scenarios**: a row per scenario the runner reported, on each side passed
  (✓) or failed (✘), its time, and for a failure the step that failed with
  its `Expected:` and `Received:`. Read from Playwright's list output.
- **Calls to the service**: each call the tests made to `/api/...`, or through
  their request context, read from each `trace.zip`: method, path and status
  before and after, and the bodies of those whose answer changed. Headers are
  not shown, and a JSON value whose key names a token, password, secret,
  cookie or authorization is written `«hidden»`.
- **AI decisions**: what the project's AI models decided during each run,
  when the project records it (below).
- Each scenario as a UML sequence diagram, numbered. When its WHEN calls an
  endpoint the code declares (Spring `@PostMapping`, JAX-RS `@Path`) — or it
  goes through a screen whose web code calls `/api/...` beside the
  requirement's id — it follows the code: one lifeline per object, each call
  with its parameters and types, each reply with what it returns, from the
  controller to the use case, the port's implementation and the client it
  calls; a scenario that ends in an error ends at the throw that carries its
  code or message. Strings, dates, clocks and lists, quiet private helpers and
  a builder's repeated calls are left out: computation, not conversation.
  Otherwise the actor, the system and the calls its steps name. The one
  at the base folds underneath, or the page says it is new or unchanged.
- The requirement's code as one UML class diagram per language: its types,
  what they reference, the implementations of its interfaces and the types
  that hold them. Java and TypeScript show typed attributes and operations with
  their visibility, `«interface»`, `«record»`, `«enumeration»` with its literals,
  associations with multiplicity, dependencies and inheritance; Kotlin, C#,
  JavaScript and Python their classes and public members. Types new since the
  base are green, changed ones amber, and the page names what changed.
- What is missing, with the command that gets it: no before, not delivered,
  no screenshots.

The base is the one `specgate check --affected` measures from;
`--base <ref>` names another, such as the commit of the requirement before.
When that base is HEAD itself — the work was done and committed on main — the
page compares with the commit before the change was opened.
The diagrams are read from the spec and the code, not drawn by a model, so the
page is the same every time it is written. Commit it with the change and link
it from the pull request.

## As a web page

```bash
specgate evidence draft-orders --html     # also writes EVIDENCE.html
specgate evidence draft-orders --open     # writes it and opens it in the browser
```

`EVIDENCE.html` is the same evidence as one page that opens with a double
click, with no server: the screens are inside it, before and after side by
side, then the scenarios, the calls, the AI decisions, each sequence at the
base and now side by side, and the classes. It is in English, light or dark
as the reader's system is. The diagrams are drawn by Mermaid, loaded from a
pinned CDN build; offline, their text is shown instead.

The screens make it large, so keep it out of git and upload it as a build
artifact for the reviewer. `--open` opens no browser in CI or when
`SPECGATE_NO_OPEN` is set.

## What the AI decided

Specgate cannot see inside your server. When it runs a requirement's
scenarios — `evidence before`, `apply`, `reproduce run` — it sets
`SPECGATE_AI_LOG` to the absolute path of
`test-results/specgate/ai-decisions.jsonl`, emptied first. Write one JSON line
there per model call, and the page shows them, before and after:

```json
{"model": "llama3.2", "input": "Haz eso", "output": {"category": "C"}, "ms": 812}
```

Only when the variable is set: in production nothing is written. The server
the tests start must inherit it — Playwright's `webServer` does.

## At archive

When the gate runs the scenarios (`bdd: required`), `specgate archive` writes
the page again before the change moves, so the archived change holds it
current. A requirement delivered with no before is named (`archive_no_before`),
and the archive goes on. A team that wants every before sets it in
`.specgate/gate.yaml`:

```yaml
evidence: required
```

Then `archive` refuses a change with a requirement that has no before;
`--force` archives it as it is.

## Next

- [A fast gate](fast-gate.md): run only the tests a change touches
- [Sealed acceptance tests](sealed-acceptance.md): the tests the before runs, sealed before the code
