# Proposal: rc-not-latest

## Intent

The 1.0 line ships as release candidates (`1.0.0-rc.N`) from the `next/1.0`
branch while 0.27 stays the version people install
([enterprise-sdd-gap.md](../../../enterprise-sdd-gap.md)). Every publish workflow
treated a pushed `v*` tag as `latest`: a `v1.0.0-rc.1` tag would have made the
candidate the default `npm install` and the `latest` image for everyone.

## Scope

- npm and GitHub Packages publish a version with a prerelease part under the
  dist-tag `next`; a final version stays `latest`.
- The Docker image of a prerelease gets its version tag only, never `latest`,
  and its smoke test runs that tag.
