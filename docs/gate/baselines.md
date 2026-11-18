# Adopt the gate without a red build

Turn the gate on in a project that already has history and it may find
things on day one: a requirement marked Implemented that no test names, a
SpotBugs finding from three years ago. Fixing all of it before the gate can
protect anything means the gate never arrives. At the end of this page
today's findings are recorded as known debt, only a finding a change adds
fails, and the debt can only shrink.

## Two baselines, for two kinds of finding

| | Gate baseline | Quality baseline |
| --- | --- | --- |
| Records | Findings of the traceability matrix under `validate --strict` | Findings of the quality checks that write SARIF — SpotBugs, PMD, Semgrep, gitleaks, SonarQube… |
| Written by | `specgate check --baseline` | `specgate quality baseline` |
| File | `docs/specs/gate-baseline.json` | `.specgate/quality-baseline.json` |
| A finding is | Its code, its file and its requirement | A fingerprint that survives the code moving |
| Re-take one part | Run `check --baseline` again | `quality baseline --accept <check>` |

Commit both files. The gate reads them in CI exactly as on your machine.

## The gate baseline

```bash
specgate check --baseline
```

```text
  ◆ specgate · check --baseline   shop

  ✔  1 finding(s) recorded in docs/specs/gate-baseline.json.
     From now on the gate fails only on a finding that is not in it. Commit the file.
```

From then on `check` and `validate` pass on the recorded findings and say so:

```text
     · 1 finding(s) baselined in docs/specs/gate-baseline.json: recorded before, not failing.
```

A finding that is fixed is reported, so the file can shrink:

```text
     · REQ-003: the baselined finding strict_tdd_1 no longer occurs.
     Run `specgate check --baseline` to drop it from the baseline.
```

**What it cannot hold.** Only the matrix's findings are debt: a test missing,
a link that points nowhere. A broken scenario, or an obligation in `spec.md`
that is still the sentence Specgate wrote, is not debt but a requirement that
says nothing, and `--baseline` refuses to record over it:

```text
  ✖  spec.md  REQ-003: its obligation in spec.md is still the sentence Specgate wrote.  [requirement_template_obligation]
     fix: Replace "The system MUST satisfy: …" and the "> Written by Specgate" note under ## REQ-003 with the real obligation — what must hold, when, and how it is observed.
  ✖  docs/specs/gate-baseline.json records 1 finding(s), and validate --strict still fails on what a baseline cannot hold.  [baseline_incomplete]
     fix: Fix what validate reports, then run `specgate check --baseline` again.
```

Fix those, then record the rest. A whole existing codebase, module by module:
[Specify a system that already runs](../reverse.md#4-turn-the-gate-on-without-a-red-build).

## The quality baseline

```bash
specgate quality baseline
specgate quality baseline --accept spotbugs     # re-take one check, on purpose
```

It runs every check that writes SARIF and records what each finds today. A
check then fails only on a finding that is not in the file, and by default
only in the files the change touched (`scope: diff`). How a finding is
recognised, and what `scope: all` changes: [Only what a change
adds](../quality.md#only-what-a-change-adds).

## Keep the debt shrinking

- Re-take a baseline only to remove what was fixed, or in a pull request
  that says why it accepts more. The diff of the file shows exactly which
  findings came in.
- `baseline_fixed` in the gate's output is the list of what to drop.
- A requirement the team is changing is the cheapest one to take out of the
  baseline: its test is being written anyway.

## Next

- [Read a failure](failures.md)
