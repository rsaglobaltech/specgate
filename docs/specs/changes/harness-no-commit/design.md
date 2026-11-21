# Design: harness-no-commit

`preflight` resolves the base with `git rev-parse --verify <base>^{commit}` first and throws a coded error; `RunCommand` reports a `harness_*` code as its own. AC-1 → SCN-643a.
