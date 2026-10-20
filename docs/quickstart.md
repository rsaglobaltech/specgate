# Joining a project

You joined a team whose repository already uses Specgate. In about ten
minutes you will see where the project stands and know the loop to deliver
your first requirement, whether the work comes as a change or as a Jira
ticket.

Setting Specgate up yourself instead? See [Getting started](getting-started.md).

## What you need

- Node.js 22 or later, and git.
- The repository cloned, with its dependencies installed:

```bash
git clone <your-repo>
cd <your-repo>
npm install
```

If the project lists `@rsaglobaltech/specgate` in its `package.json`, run
every command below as `npx specgate`, which uses the version the team pinned.
If it does not (a Java or Python project, for example), use
`npx @rsaglobaltech/specgate@latest` in place of `specgate`. Commands find the
project root from your current directory.

## 1. See where the project stands

```bash
npx specgate status
```

It lists every requirement and what it still needs (its scenario, its test,
its code), and ends with the one command to run next.

## 2. Read the requirement

A **requirement** (`REQ-007`) is one numbered obligation in `spec.md` or in a
capability spec under `docs/specs/capabilities/`. Its **scenario** is a Gherkin
example in `features/`, tagged `@REQ-007 @SCN-007`. Read both before you write
any code. The words are defined in [Concepts](concepts.md#vocabulary).

## 3. Open a change

New work goes through a **change**: a folder under `docs/specs/changes/` that
holds the requirements being added or modified until they are built. Open it
the way your team gets its work.

**From an idea or a request:**

```bash
npx specgate propose rounding-rules
```

It creates `docs/specs/changes/rounding-rules/` with a proposal and a delta
(the requirements and scenarios this change adds or modifies), and reserves
the next `REQ` ids. Write the requirement and its scenario in the delta, with
real values in place of the `<placeholders>`.

**From a Jira ticket:**

```bash
npx specgate propose --from-ticket KAN-13 --check
npx specgate propose --from-ticket KAN-13
```

The first command checks the ticket against the team's Definition of Ready
(rules T1 to T9). The second opens the change from the ticket's text, then
creates and pushes the branch `feature/KAN-13-<slug>`. The project must already
be connected to Jira: see [From a Jira ticket](from-a-ticket.md).

## 4. Build it, test first

Write the test first and name the requirement in it. That mention is the link
between the requirement and the test: there is nothing else to declare.

```java
// REQ-007 SCN-007: a payment over the limit is refused
@Test void refusesPaymentsOverTheLimit() { … }
```

Then write the code until the test passes. On a ticket's change, start every
commit message with the ticket key (`KAN-13 REQ-007: refuse payments over the
limit`).

## 5. Deliver each requirement

```bash
npx specgate apply REQ-007
```

`apply` refuses while no test names the requirement. Then it runs the gate
(the specification, the links and your test suite) and marks the requirement
`Implemented` only if the gate passes. Without an id it takes the next
requirement `status` names. `apply` does not commit; commit when it is green.

## 6. Archive the change, then open the pull request

When every requirement of the change is `Implemented`:

```bash
npx specgate archive rounding-rules
npx specgate check
```

`archive` merges the delta into the specification, the traceability matrix
and `features/`, and refuses while a requirement is still pending. `check` is
the whole gate, the same one CI runs. Commit, push and open your pull request:
the spec and the code reach review together.

For a ticket's change, `alm pr` pushes the branch and opens one pull request
per ticket on GitHub:

```bash
npx specgate alm pr kan-13-register-vehicle-entry
```

If `check` says it checked the specification and not the code, no test
command is set. Run `npx specgate config set test_cmd "npm test"` once.

## The loop, in one line

```text
status → propose → test that names the REQ → code → apply → archive → check → pull request
```

## Next

- [Your team's first pull request](first-pr.md) — what the author writes, what the reviewer reads
- [From a Jira ticket](from-a-ticket.md) — the ticket path in full
