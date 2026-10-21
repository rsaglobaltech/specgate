# Proposal: driver-fallback

## Intent

A project with no `node_modules` of its own, Maven for one, registers the merge drivers at this machine's copy of specgate. When that copy goes away (an `npx` cache cleared, a global install upgraded or removed), git still routes the capability specs and the matrix to the driver, `node` cannot find it, and the merge stops with the file left as our side alone: no conflict markers, nothing that shows the other branch's text was there. Resolving it the usual way, `git add`, drops the other side.

## Scope

The registered driver checks that its file is there; when it is not, it says so and merges the file by lines, as git would have done without the driver. `specgate doctor` warns about a driver whose file is gone.

## Out of scope

Making the driver reproducible in projects without `node_modules`: `harness init` already says the driver is machine-local and how to fix that.
