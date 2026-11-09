# Proposal: run7-docker-report

## Intent

The seventh truck-flote run (Specgate 0.27.8) found two things a person meets on the first requirement:

- **S61.** Docker Desktop was stopped. `harness run --req REQ-002` passed `validate` and the architecture
  check, then `npm test` failed three times in about 15 seconds each — Testcontainers: "Could not find a
  valid Docker environment" — and each failure went back to the agent as a failing test. Nothing in the
  code could fix it, and the three attempts were spent.
- **S63.** After REQ-002 was delivered, the studio's report titled `SCN-002` "<what happens>": the
  report collected scenario titles from every Markdown file under `docs/specs`, and the draft's
  `DRAFTING.md` holds that template line before the delta does. The report is what the client reads.

## Scope

- REQ-279: before the first attempt, `harness run` — and the studio's Build, which starts it — checks
  Docker when the project needs it (a quality check that runs in Docker or is given Docker, or
  Testcontainers in a build file) and refuses, naming the fix, before any agent runs. A test command
  whose output says Docker is missing stops the requirement as an environment failure, told to the
  person, the way a check that could not run does (REQ-267).
- REQ-280: the report reads scenario titles from the specification only — `spec.md`, capability specs
  and open changes' deltas — never from `DRAFTING.md`, a proposal or the archive.

The in-flight view (ADR-0035) already reads only deltas; the report's title lookup was the one reader
that walked every file.
