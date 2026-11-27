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
  use: { screenshot: "on", video: "on" },
});
```

`specgate doctor` warns (`doctor_evidence_media`) when they are off.

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

## The page

```bash
specgate evidence draft-orders
```

It writes `docs/specs/changes/draft-orders/EVIDENCE.md`. Per requirement:

- A table with one row per test: its last screenshot before and after. The
  pictures are copied into `evidence/` beside the page, so they render in the
  pull request; one over 300 KB is named, not copied.
- The paths of the videos and traces, under `.specgate/evidence/`.
- Each scenario as a sequence diagram: the actor, the system, a message for
  each `POST /api/...` its steps name. The one at the base folds underneath,
  or the page says it is new or unchanged.
- Each file of the requirement's code as a class diagram — TypeScript,
  JavaScript, Java, Kotlin, C# or Python — with a note of the members added
  or removed since the base.
- What is missing, with the command that gets it: no before, not delivered,
  no screenshots.

The base is the one `specgate check --affected` measures from. The diagrams
are read from the spec and the code, not drawn by a model, so the page is the
same every time it is written. Commit it with the change, link it from the
pull request; `archive` carries it with the change.

## Next

- [A fast gate](fast-gate.md): run only the tests a change touches
- [Sealed acceptance tests](sealed-acceptance.md): the tests the before runs, sealed before the code
