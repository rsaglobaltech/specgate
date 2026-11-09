Feature: A finding in a file git ignores is not the change's

  @REQ-241 @SCN-241a
  Scenario: A development secret in .env.local
    Given `.gitignore` lists `.env.local`, a secrets scan judged on the change, and `src/config.ts` changed
    When the scan reports a finding in `apps/web/.env.local` and one in `src/config.ts`
    Then only the finding in `src/config.ts` is counted

  @REQ-241 @SCN-241b
  Scenario: Vulnerabilities in Maven's bill of materials
    Given `.gitignore` lists `target/`, and a dependency scan with `scope: all` that reports a finding in `apps/api/target/bom.json`
    When the check's SARIF is read
    Then the finding is counted, and fails the check until the baseline holds it
