# forja and Specgate

[Specgate](../getting-started.md) keeps a project's requirements, their scenarios
and the tests that prove them in step. forja can generate a project ready for it, and `forja add
usecase` links each new use case to its requirement. This page covers what forja does; the Specgate
documentation covers Specgate itself.

## Turn it on

Specgate comes with the `specgate` extra. It is on by default for Java backends. On Node, ask for it:

```bash
forja init acme --yes --extras lint,specgate
forja init shop --yes --backend spring          # lint, docker and specgate by default
```

In the wizard, tick "Specgate (spec-driven development)" under Extras.

## What forja installs

| What | Where |
| --- | --- |
| `@rsaglobaltech/specgate`, at the version forja pins | root `package.json`, `devDependencies` |
| `spec`, `spec:status`, `spec:check` scripts | root `package.json`, running `specgate`, `specgate status` and `specgate check` |
| The brief to fill in | `docs/brief.md` |
| The day-to-day guide | `docs/specgate.md` |

`docs/brief.md` starts with four fields for Specgate, then a space for the client's brief:

```yaml docs/brief.md
---
product: acme
surfaces: [api, web]
actors:
  - { name: Customer, surfaces: [api, web] }
modules: []
---
```

Paste the brief below that block as you received it. Specgate checks that every value in a scenario
comes from this text or from `assumptions.md`.

## Adoption after the install

When forja installs the dependencies, it adopts Specgate in the new project:

```bash
npx specgate adopt --no-capabilities
npx specgate config set test_cmd "npm test"
npx specgate config set arch_cmd "npm run arch"
```

The third line puts the architecture in the gate: `specgate check`, `specgate apply` and the harness
run `npm run arch` between the specification and the tests, so code in the wrong layer fails the gate
even when every test passes. On Node, `npm run arch` checks the core's import rules; on Java it runs
the ArchUnit test alone. It needs Specgate 0.20 or newer; an older one leaves the gate as it was.

With git on, it commits the result as `chore: adopt Specgate`. If you used `--skip-install`, or the
adoption failed (no network, for example), forja prints those commands among the next steps
instead. Either way, the next steps end with:

```bash
npx specgate propose --from-brief   # after you fill in docs/brief.md — see docs/specgate.md
npx specgate          # where the specification stands, and what to run next
```

`forja doctor` warns until the project is adopted, which it detects by the presence of `spec.md`
and `docs/specs/traceability.md`.

### Move to the current Specgate

The steps below use the four verbs (`propose`, `apply`, `status`, `archive`), which need Specgate
0.21 or newer. Check the version forja pinned in the root `package.json`; if it is older, move the
project to the current release:

```bash
npm install --save-dev @rsaglobaltech/specgate@latest
```

## Module by module

The flow below is the one in the generated `docs/specgate.md`. Run `npx specgate` on its own whenever
you lose track: it shows where the specification stands and the command to run next.

1. **Write the brief.** Paste the client's brief into `docs/brief.md` and fill in the four fields
   and a section per module. `npx specgate propose --from-brief` explains each field;
   `npx specgate propose --from-brief --agent "claude -p"` lets your agent propose them;
   `npx specgate propose --from-brief --check` checks the brief.
2. **Draft a module.** Your agent writes the requirements and scenarios, and Specgate checks them
   against the brief:

   ```bash
   npx specgate propose --from-brief orders --agent "claude -p"
   ```

   Without an agent, `npx specgate propose --from-brief orders` prints the line to paste into one. Repeat until it
   says *Ready to review*.
3. **Review it** with whoever knows the business. The open questions go to the client. The draft
   stays an open change while you build it.
4. **Build each requirement, test first.** A test that names `REQ-007` is the link. `forja add
   usecase` writes the use case and that test for you; see the next section.
5. **Apply each requirement.** Specgate refuses while no test names it or the suite is red, and
   marks it Implemented when the gate passes:

   ```bash
   npx specgate apply REQ-007
   ```

6. **Archive the module** once every requirement in it is Implemented. `archive` refuses before
   that; it merges the requirements into the specification, on your branch, before the pull request:

   ```bash
   npx specgate archive draft-orders
   ```

7. **Before every pull request**, run the gate:

   ```bash
   npx specgate check
   ```

When the work arrives as Jira stories instead of a brief, each ticket opens its own change with
`npx specgate propose --from-ticket <KEY>`; the build, apply and archive steps are the same. See
[From a Jira ticket](../from-a-ticket.md).

Each module of the specification is a hexagonal module of the code: `application/<module>/` in
`packages/core` on Node, `apps/api/.../<module>/` on Java.

## forja add usecase with Specgate

In a project where Specgate is adopted, `forja add usecase` also creates the requirement:

```bash
forja add usecase orders/PlaceOrder
```

1. forja checks first that no file would be overwritten, so a refused command leaves no orphan
   requirement.
2. It runs `specgate new "Place order"`. The title comes from the class name, or from `--title`.
3. It writes the use case and its test, with the new id in the test's name:

   ```ts PlaceOrderUseCase.test.ts
   describe("REQ-003 Place order", () => {
     it("runs", async () => { /* ... */ });
     it.todo("proves the scenario in <the feature file Specgate wrote>");
   });
   ```

   On Java, the id goes in `@DisplayName("REQ-003 Place order")`, and the pending scenario is a
   `@Disabled` test. The use case's comment says `Specified by REQ-003`.
4. It runs `specgate matrix` to regenerate the traceability matrix, so `specgate check` sees the link.

The output names the requirement, the scenario file when Specgate reports one, and the next step:

```text
◇  REQ-003 · Place order
│  scenario to write: <the feature file>
└  Next: write the scenario, make the test prove it (npm test), then npx specgate done REQ-003
```

forja 1.0.0 prints the older command name. Run `npx specgate apply REQ-003` for that last step.

### The options

| Option | Effect |
| --- | --- |
| `--req REQ-007` | names an existing requirement instead of creating one. The id must look like `REQ-` followed by digits. |
| `--title "Place an order"` | the title `specgate new` gets, and the one in the test name |
| `--no-spec` | no requirement and no id in the test |
| `--dry-run` | shows the files; creates no requirement |

`--req` works for requirements that came out of `specgate propose --from-brief`: the archived module already has
`REQ-007`, and you want the code for it.

```bash
forja add usecase orders/PlaceOrder --req REQ-007
```

If Specgate cannot write the requirement, forja still writes the files and warns
`No requirement linked:` with the reason.

## In CI

With the `ci` extra too, the generated GitHub Actions workflow has a `spec` job that runs
`validate . --strict` with the Specgate version forja pinned. The tests themselves run in the other jobs.
