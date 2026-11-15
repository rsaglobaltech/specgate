# Discover: rc8-site

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The documentation site shows only the stable version. The 1.0 candidates are written on their own line,
and a reader who wants to try one has no way to see what it adds, or that it exists, without reading the
changelog.

## Use case

A reader of the site sees the version they are reading at the top left and chooses the other one there:
the stable documentation, or the candidate's, which opens on a page that explains what the candidate adds,
feature by feature. A reader of the candidate's pages always knows they are reading a candidate, and can go
back to the stable ones.

## Acceptance criteria

- AC-1: every page of a site that carries both versions names both at the top left, marks the one being
  read, and the candidate's entry opens its page of new features; a site of one version shows its version
  as before.
- AC-2: the candidate's pages say they document a candidate and lead to the stable ones, and their edit
  link edits the candidate's line.
- AC-3: the page of new features explains each feature of 1.0 and names every candidate published, so it
  never falls behind the changelog.
