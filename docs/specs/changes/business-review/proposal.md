# Proposal: business-review

## Intent

AIUP's pitch is "specs your customers can read": each iteration ends with a
business review of the use cases, its Studio is a shared web workspace with
Reader, Editor and Administrator roles where every edit is a Git commit, and
its business processes chain use cases into end-to-end journeys whose every
path becomes a test case. `specgate studio` is a local, single-user app for
the developer; a stakeholder has nothing to open, nothing to sign, and no way
to see a journey that crosses requirements.

## Scope

In scope:

- REQ-551: `specgate review <change>` writes a self-contained HTML page of a
  change in plain language, for people who do not read Markdown in a repo.
- REQ-552: journeys `JRN-NNN` — a scenario that chains requirements — with
  their own column in the matrix and a test owed once every requirement in
  them is delivered.
- REQ-553: `specgate studio --team` serves the studio to several people,
  with roles read from `studio.team.yaml`; a Reader cannot write.
- REQ-554: in team mode an Editor's change is written to a branch and opened
  as a pull request, never to the default branch.

Out of scope:

- A hosted service: the team studio runs where the team runs it (a container,
  an internal host), with the Git provider's sign-in.
- A BPMN editor.

## Approach

`review` reuses the studio's report renderer with an inline stylesheet, so the
page opens from a file or a mail attachment. Journeys are Gherkin scenarios
tagged `@JRN-NNN` and the `@REQ-NNN` of each step's requirement. Team mode
puts the existing studio server behind an OAuth sign-in with GitHub or GitLab;
writes go through the same ALM `pr` code `alm pr` uses.
