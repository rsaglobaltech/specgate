# Proposal: npm-trusted-publishing

## Intent

The npm publish job authenticates with a long-lived `NPM_TOKEN`. npm warned,
on the 0.35.0 publish, that tokens which bypass two-factor authentication are
being restricted for publishing. A stolen token can also publish anything, from
anywhere. npm's trusted publishing (OIDC) lets GitHub Actions publish this
repository's package with a short-lived credential tied to this workflow.

## Scope

In scope:

- The publish job ready for trusted publishing: npm 11.5.1 or later, `id-token: write`.
- The token kept only as npm's fallback until the trusted publisher has published once, then removed; the switch documented in the release process.

Out of scope:

- GitHub Packages, which already publishes with the workflow's own `GITHUB_TOKEN`.

## Approach

npm tries OIDC first and falls back to a token, so the job can carry both while
the trusted publisher is configured on npmjs.com; after one release proves it,
the secret is deleted and npm's "disallow tokens" setting turned on.
