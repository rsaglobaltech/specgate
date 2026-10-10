<!-- csda:allow-placeholders — this guide quotes the {{VAR}} template syntax. -->

# Troubleshooting

When something does not behave the way the guides say it should.

---

## Troubleshooting

| Symptom                                                                           | Cause                                                                    | Fix                                                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `validate` says **"missing traceability.md row"** for a `.feature` you just added | The matrix needs every feature file registered.                          | Add a row pointing to the relative path of the `.feature`.                                           |
| `validate --strict-tdd` fails on a half-baked REQ                                 | A `REQ-NNN` exists in `spec.md` without a `.feature` or executable test. | Either add the test, or mark the row in `traceability.md` as `Deferred`.                             |
| `expand` leaves `{{VARS}}` in generated files                                     | A required `--var` was not provided.                                     | Re-run with the missing variable. Check `pack.yaml > variables.required`.                            |
| `specops sync` rewrites your edits to a generated file                            | Generated files are meant to be regenerable.                             | Customise the **pack template**, not the generated output.                                           |
| `pack lint` rejects a pack that worked before                                     | A new schema version added required fields.                              | Run `npx @rsaglobaltech/specgate@latest pack lint …` against the latest CLI to see the actual error. |
| `npx @rsaglobaltech/specgate …` hangs the first time                              | npm is resolving the package.                                            | Subsequent runs are cached; pin the version (e.g. `@0.1.0-beta.3`) in CI.                            |
| `specops sync` complains "no lockfile and no `specops.config.yaml`"               | Neither source of truth is present.                                      | Run `expand` once, **or** create `specops.config.yaml` (see §9).                                     |

Still stuck? Open an issue with the output of `npx @rsaglobaltech/specgate@latest validate --help` plus the failing command. The [Comparisons doc](comparisons.md) lists migration paths from `spec-kit`, Cursor rules, Aider conventions, and plain READMEs if the answer is "this tool isn't the right fit".

---

## Next

- [Diagnose the project](validating.md)

## When another attempt cannot help

It stops at the first failure no retry can fix: the agent out of quota or
rate-limited; a gate failing only on files the agent may not edit (a person
fixes the spec — "Nothing proves" is still retried, a test fixes it); a
requirement waiting on a question. At the `--timeout` (1200 s) the agent and
everything it started are stopped. `harness init` puts the build in the gate
when there is one: passing tests with a broken build is not delivered.
