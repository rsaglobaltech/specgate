# Proposal: truck-flote-run2

## Intent

The second truck-flote run, with Specgate 0.27.2 and forja 1.0.2 only, one
documented command at a time, found these in Specgate (that project's
`docs/specgate-issues.md`, S21–S34):

- a secret in a file git ignores reached the baseline (S21);
- the forja install hint named npm, where forja is not (S24);
- the brief checks misread Spanish "si" (whether) and missed "lo más …
  posible", "cerca", "casi", "aceptable" (S25, S26);
- `status` on a project generated from a brief proposed the adoption path (S28);
- `draft` did not explain the front matter its template promised (S29);
- ten modules passed, and a `mobile` actor in a project without a mobile
  app (S30, S31);
- D6 reported values listed in another wording (S33);
- the undo after an agent run took a person's edit with it (S34);
- `init --yes` in a folder with code scaffolded a second project inside it without a word (S35);
- the Maven coverage check took 30 s more on every run: JaCoCo instrumented Testcontainers, and its shutdown hook deadlocked with Spring stopping the container until Surefire killed the JVM (S36, first logged as forja's F10).

## Scope

In scope: each of the above. The guide's claim that `--check` wants a
section per module (S32) is corrected in the documentation: a brief in free
text, with a front matter, is allowed.

Out of scope: forja's issues (F10, F11), fixed in forja.
