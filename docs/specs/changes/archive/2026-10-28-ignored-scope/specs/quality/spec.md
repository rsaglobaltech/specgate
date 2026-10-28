# Delta — quality

## ADDED Requirements

### Requirement: REQ-258 — The quality reports are not committed

The system SHALL, on `specgate quality init`, add `.specgate/quality/` — where each check writes its SARIF and reports — to the project's `.gitignore`, once, so a quality run leaves no untracked file behind; the baseline, `.specgate/quality-baseline.json`, stays outside it, to be committed.

#### Scenario: SCN-258a — A run after init

- GIVEN a project where `specgate quality init` ran and its result is committed
- WHEN a quality run writes `.specgate/quality/osv.sarif`
- THEN `.gitignore` lists `.specgate/quality/`, the report is not shown by `git status`, and `.specgate/quality-baseline.json` is not ignored

<!-- specgate:trace status=Implemented test=tests/unit/quality-presets.test.ts actor=Developer kind=functional -->

## MODIFIED Requirements

### Requirement: REQ-241 — A finding in a file git ignores is not the change's

The system SHALL leave out of the findings of a check judged on the change (`scope: diff`), and of its baseline, the findings in files that git ignores, since they are never part of a change; and SHALL keep them for a repository-wide check (`scope: all`), which reads generated files on purpose — a dependency scan reads the bill of materials Maven writes in `target/`.

#### Scenario: SCN-241a — A development secret in .env.local

- GIVEN `.gitignore` lists `.env.local`, a secrets scan judged on the change, and `src/config.ts` changed
- WHEN the scan reports a finding in `apps/web/.env.local` and one in `src/config.ts`
- THEN only the finding in `src/config.ts` is counted

#### Scenario: SCN-241b — Vulnerabilities in Maven's bill of materials

- GIVEN `.gitignore` lists `target/`, and a dependency scan with `scope: all` that reports a finding in `apps/api/target/bom.json`
- WHEN the check's SARIF is read
- THEN the finding is counted, and fails the check until the baseline holds it

<!-- specgate:trace actor=Developer feature=features/quality/REQ-241.feature kind=functional status=Implemented test=tests/unit/quality-baseline.test.ts -->
