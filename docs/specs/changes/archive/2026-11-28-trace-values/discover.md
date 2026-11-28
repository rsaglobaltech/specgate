# Discover: trace-values

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A project run on 2026-11-27 wrote `actor=Adulto responsable` in a trace.
Specgate stored the actor as `Adulto` and said nothing; the person found it
only in the generated diagrams. Quoting it would not have helped everywhere:
the domain view read `actor="Adulto responsable"` as `"Adulto`.

## Use case

The person writes a trace; validate tells them at once when a value was cut,
and how to write it so it is not.

## Acceptance criteria

- AC-1: an unquoted value followed by a stray word is reported, with the quoted form.
- AC-2: an actor is read the same way by every part of Specgate.
