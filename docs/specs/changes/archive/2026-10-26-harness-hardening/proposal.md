# Proposal: harness-hardening

## Intent

A night of `harness run --chain` over twenty requirements in an adopter's web app ended with 26 MB free and ENOSPC: the in-flight view copied each worktree's `.next/cache`. Re-running delivered requirements stopped at their old branches and ran in an order nobody asked for; tests started by hand in the working copy broke the post-merge gate, which undid a merge whose attempt had passed; and `specgate check` ran a test command that names the requirement with the literal `{req}`.

## Scope

In scope:

- The in-flight copy takes only what git keeps; a requirement does not start on a nearly full disk (REQ-184).
- `--req` order is respected; a branch already merged is recreated without `--force` (REQ-185).
- One run per working copy, a warning in `check`, and a post-merge failure that says where it ran (REQ-186).
- The gate's placeholders filled outside the harness (REQ-183).

Out of scope:

- Running the post-merge gate in a worktree of its own: it doubles the setup of every requirement.
- Cleaning the temporary folders the test suite leaves on Windows.

## Approach

Small guards in `scripts/lib/harness-guard.ts`, each a pure decision with its I/O at the edge, called from `harness run`, the in-flight view and `check`; the placeholders are filled in the core's `DoneVerification`.
