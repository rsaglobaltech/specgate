# Discover: semver-release

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The frozen surface stops a pull request from breaking a user. Three gaps were
left: a project written by an older release could stop working without a test
noticing, a version could be published with a number that does not say what
it changed, and a published version nobody installed could be broken for
everyone who does.

## Use case

A maintainer tags a release. The build has already read every older release's
project; the release stops if its number contradicts what it changes; once on
npm, it is installed and used before anyone else does.

## Acceptance criteria

- AC-1: A project each release wrote keeps working with every build.
- AC-2: A version whose number contradicts its changes is not published.
- AC-3: A published version is installed from the registry and used, under the tag it was meant for.
