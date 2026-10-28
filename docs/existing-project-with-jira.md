# An existing codebase, with work in Jira

This page is for a team with a codebase that is years old and work that
arrives as Jira tickets. At the end, Specgate runs in your repository without
any change to your code, Jira is connected, and your first ticket has gone
through the gate to a merged pull request.

What you need first:

- Node.js 22 or later on the developers' machines and in CI.
- The repository, with a test command that already works (`mvn -B test`,
  `npm test`, `./gradlew test`…).
- Jira Cloud, set up as described in
  [From a Jira ticket](from-a-ticket.md#one-time-setup). `specgate alm pr`
  opens pull requests on GitHub; on Bitbucket or GitLab, see
  [Another Git host](#another-git-host).

## Do not specify the past

You do not write a specification for the code you already have. The
specification grows one ticket at a time: each ticket adds the requirements
for the behaviour it changes, and code nobody touches stays unspecified. This
is the strangler approach. After a few months, the parts of the system that
change most are the parts that are specified, which is where a specification
pays off.

A **requirement** (`REQ-007`) is one sentence the system must satisfy; a
**scenario** (`SCN-007a`) is a concrete Given/When/Then example of it. See
[Concepts](concepts.md#vocabulary) for the other terms on this page.

## 1. Adopt Specgate in place

If the repository already has a `package.json`, add Specgate as a development
dependency, so every developer and CI run the same version:

```bash
npm install --save-dev @rsaglobaltech/specgate
npx specgate init --dry-run
npx specgate init
```

In a repository without one, such as a pure Maven or Gradle project, do not
add a `package.json` just for Specgate. Run it with `npx` and a pinned version
instead, and use the same version in CI:

```bash
npx @rsaglobaltech/specgate@0.27.6 init --dry-run
npx @rsaglobaltech/specgate@0.27.6 init
```

The commands below write `npx specgate`; in a repository without a
`package.json`, read it as `npx @rsaglobaltech/specgate@0.27.6`.

In a repository that already has a `pom.xml`, `build.gradle`, `package.json`
or similar, `specgate init` adopts the project in place; it is the same as
`specgate adopt`. It writes `spec.md`, the traceability matrix and a few
supporting files, never overwrites a file that exists, and never touches your
source code. `--dry-run` shows what it would write.

Adopting also seeds a few proposed requirements from your folder layout. They
start as Draft, and a Draft requirement owes nothing to the gate. To start
with an empty specification instead, use `specgate adopt --no-capabilities`.

Then tell the gate how to run your tests, and add it to CI:

```bash
npx specgate config set test_cmd "mvn -B test"
npx specgate ci init
git add -A && git commit -m "chore: adopt Specgate"
```

Your existing tests keep running inside the gate, exactly as before. They do
not need to name a requirement: only a requirement past Draft needs a test that
names it. Make the CI job a required check on your base branch, as described in
[Your team's first PR](first-pr.md#make-the-gate-a-required-check).

## 2. Connect Jira

Follow [the one-time setup](from-a-ticket.md#one-time-setup): a read-only
Jira token, a GitHub token for pull requests, `alm.config.yaml`, the GitHub
for Jira app, the workflow, the automation rules and branch protection. Map
each epic you work on to a capability under `epics:`. A **capability** is an
area of the specification; for an old codebase, name it after the module or
the business area the epic covers (`billing`, `customer-accounts`).

## 3. The first ticket, end to end

Pick a small story. Then follow
[the daily loop](from-a-ticket.md#the-daily-loop-per-ticket): check the
ticket, open its change, have the agent draft it, review, build, archive, open
the pull request, merge. The first time takes longer because every step is
new; from the second ticket on it is the normal rhythm of the team.

## Bugs in behaviour nobody specified

Most bugs in an old codebase are in behaviour that was never written down. Do
not look for a requirement to blame. Treat the fix as a new requirement:

1. Open the bug's change: `specgate propose --from-ticket KAN-42`. A Bug gets
   a `bugfix/KAN-42-…` branch.
2. Write the requirement as the correct behaviour, with a **regression
   scenario**: Given the conditions of the report, When the user does what the
   report says, Then the correct result.
3. Write its test first and watch it fail: it reproduces the bug. Fix the code
   until it passes, then `specgate apply REQ-…`.

From then on, that behaviour is specified and guarded by the gate.

## Characterization tests before risky changes

Before you change an area that has few tests, record what it does today. Open
a change whose requirements describe the current behaviour, and write tests
that name them. These tests pass against the code as it is, so `specgate apply`
accepts them at once: a change whose tests already pass is valid, and it is the
point here.

Then the ticket's own change modifies those requirements. The difference in
the specification and in the tests shows the reviewer exactly what the ticket
changed, and nothing else changes silently. See
[Change a requirement that already shipped](reviewing-changes.md).

## What not to import

- **Closed tickets.** They describe work that is already done, and the code is
  the record of it. Specgate reads one open ticket at a time, when work on it
  starts.
- **The whole backlog at once.** A ticket enters the specification when the
  team starts it, not before. Do not run `specgate alm sync` or
  `specgate alm pull` on top of this flow: that is the other Jira mode, and it
  writes to Jira (see [Two ways to connect Jira](alm.md)).

## Architecture rules for new code only

`specgate check` can run your architecture check (ArchUnit, dependency-cruiser…)
before your tests: set it with `specgate config set arch_cmd "<command>"`. On
an old codebase, scope the rules to the new modules or packages, so the gate
holds new code to your target architecture without failing on layering that
predates it. Widen the scope as old modules are rewritten.

## Maven projects

`test_cmd` can be any command, so use the Maven profiles you already have.

**The full suite** is what `specgate check`, `specgate apply` and CI run:

```bash
npx specgate config set test_cmd "mvn -B -P unit-test,integration-test verify"
```

Use your own profile names; the ones here (`unit-test`, `integration-test`)
are an example.

**A fast gate per requirement.** Tag each JUnit 5 test with its requirement.
The tag is also the mention that links the test to the requirement:

```java
@Test
@Tag("REQ-007")
void aPaidInvoiceDownloadsAsPdf() { /* … */ }
```

Then run only that requirement's tests. The harness (`specgate harness run`,
which builds requirements with an agent) replaces `{req}` in its test command
with the requirement it is building (the agent is set as usual, in
`harness.config.yaml` or with `--agent`):

```bash
npx specgate harness run --test-cmd "mvn -B -P unit-test test -Dgroups={req} -DfailIfNoTests=true"
```

`-DfailIfNoTests=true` matters. Without it, a test that lacks the tag is not
selected, Maven runs zero tests and reports success, and the requirement looks
proven when nothing ran. Say it in your team's rules too, below Specgate's
block in `AGENTS.md`, so the agent tags every test it writes:

```markdown
## Team rules

- Tag every test with the requirement it proves: `@Tag("REQ-007")`.
```

Only `harness run` replaces `{req}` (and `{scenario}`, `{feature_file}`).
`specgate check` and `specgate apply` run `test_cmd` exactly as written, so do
not put `{req}` in `test_cmd`. To run one requirement's tests by hand, write
the id yourself:

```bash
npx specgate apply REQ-007 --test-cmd "mvn -B -P unit-test test -Dgroups=REQ-007 -DfailIfNoTests=true"
```

CI keeps running the full suite from `test_cmd`, so the fast gate never
replaces it.

**A parent (super) POM** needs nothing from Specgate. It runs your command from
the project root, and Maven resolves the parent as usual, from the repository
or your settings. A project with a Maven wrapper can use `./mvnw` instead of
`mvn`.

## Another Git host

`specgate alm pr` opens pull requests on GitHub only. On Bitbucket or GitLab,
everything else on this page works the same: the ticket's branch, the
requirements, the gate, the archive. Open the pull request yourself, with the
ticket key at the start of its title (`KAN-13 Register vehicle entry`), and
paste the requirements and the result of `specgate check` into its
description. Bitbucket's and GitLab's own Jira integrations link the branch,
the commits and the pull request to the ticket from the key, so the Jira
Automation rules move the ticket as they do with GitHub. For the CI job,
`specgate ci init --provider jenkins` (or `gitlab`) writes the gate.

Keep the `base:` line of the `pr:` block even without `alm pr`. With gitflow,
where work starts from `develop` and the repository's default branch is
`main`, it is what the ticket's branch, the ticket-key check and the id check
measure from:

```yaml
pr:
  base: develop # the branch pull requests target
```

## Next

- [From a Jira ticket](from-a-ticket.md)
- [Your team's first PR](first-pr.md)
