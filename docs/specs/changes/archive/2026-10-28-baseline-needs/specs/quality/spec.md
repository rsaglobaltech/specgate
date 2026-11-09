# Delta — quality

## ADDED Requirements

### Requirement: REQ-240 — The baseline runs what a check needs first

The system SHALL accept `needs: <check>` on a check, naming an earlier check whose output it reads, refusing a name that is not an earlier check; and `specgate quality baseline`, with `--accept <check>` too, SHALL run a check's needs, once each, before it; and the Maven preset's `dependencies` SHALL need `sbom`.

#### Scenario: SCN-240a — A scan of what a build step writes

- GIVEN a check `prep` that writes `built.txt`, and a check `scan` with `needs: prep` that writes SARIF from `built.txt` and writes none without it
- WHEN `specgate quality baseline --accept scan` runs on a fresh tree
- THEN `prep` runs first and `scan`'s finding is recorded in the baseline

<!-- specgate:trace status=Implemented test=tests/unit/quality-baseline.test.ts actor=Developer kind=functional -->
