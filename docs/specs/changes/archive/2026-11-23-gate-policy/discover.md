# Discover: gate-policy

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The gate is all or nothing: `--strict` fails on every rule it knows, and a
team that wants coverage reported rather than failed, or a gate that starts
lenient and tightens on a date, has to drop flags from its CI file — once per
provider — and lose track of what its gate requires. Issue #494; this change
is its first slice.

## Use case

A team keeps in its repository what its gate requires: a preset, and for each
rule whether it fails the gate, is reported, or does not run, with a date from
which the errors count. The same policy applies on a laptop and in every CI.

## Acceptance criteria

- AC-1: A policy file names a preset (minimal, standard, strict) and overrides any rule with error, warning or off; a file that cannot be read stops the gate with what is wrong and how to write it.
- AC-2: Under the policy, a rule set to warning reports its findings and the gate passes; a rule set to off does not run; a rule asked for by its own flag fails as before.
- AC-3: Before the policy's enforcement date every error is reported as a warning, and the gate says until when.
- AC-4: A project with no policy file has the gate it had: every rule fails it.
- AC-5: The policy is set through the configuration commands, which refuse a value the policy could not read; a new project is given the standard preset.
