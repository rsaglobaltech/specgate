# Proposal: sgate-alias

## Intent

`specgate` is long to type many times a day. A short alias of the same name,
`sgate`, saves it without introducing a second name (ADR-0042).

## Scope

In scope:

- The package installs `sgate`, the same entry point as `specgate`.
- `specgate completion` completes `sgate` too, in bash, zsh and fish.
- One line in the getting-started guide and the command reference.

Out of scope:

- Using `sgate` in examples, help or messages: they keep `specgate`.

## Approach

A second `bin` entry in `package.json` pointing at `bin/specgate.js`; the
completion scripts name it next to `specgate`.
