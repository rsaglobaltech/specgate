# Proposal: ignored-scope

## Intent

The fifth truck-flote run, with Specgate 0.27.5, found the Maven dependency
scan reporting 18 known vulnerabilities and the gate counting none of them
(S44): REQ-241 left out findings in files git ignores, and osv-scanner points
every finding at the bill of materials Maven writes in `apps/api/target/`,
which git ignores. Since 0.27.3 no vulnerable dependency of a Maven project
could fail the gate, nor reach the baseline.

The same run found `.specgate/quality/` — the reports every check writes —
untracked after each quality run (S45).

## Scope

- REQ-241 applies to checks judged on the change (`scope: diff`) only; a
  repository-wide check reads generated files on purpose.
- `quality init` adds `.specgate/quality/` to `.gitignore` (REQ-258).
