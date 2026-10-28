Feature: A finding in a file git ignores is not the repository's

  @REQ-241 @SCN-241a
  Scenario: A development secret in .env.local
    Given `.gitignore` lists `.env.local`, and a secrets scan reports a finding in `apps/web/.env.local` and one in `src/config.ts`
    When the check's SARIF is read
    Then only the finding in `src/config.ts` is counted
