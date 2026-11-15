# Docs Site

## Requirements

### Requirement: REQ-400 — The site names both versions at the top left

The system SHALL render, when the documentation site is built with a stable and a candidate version, a version picker at the top left of every page and of the landing page that lists both versions, marks the one being read with `aria-current`, links the stable entry to the stable documentation home and the candidate's to its page of new features, each relative to the page; built with one version it SHALL show that version as a plain badge.

#### Scenario: SCN-400a — A reader picks the candidate

- GIVEN the site is built with `--channel stable --versions stable=0.27.9,next=1.0.0-rc.8`
- WHEN the reader opens `harness.html`, `case-studies/<page>.html` or the landing page
- THEN the picker lists v0.27.9 as current and v1.0.0-rc.8 linking to `next/whats-new-1.0.html` from that page; built without `--versions`, the page shows the plain badge

<!-- specgate:trace actor=Developer feature=features/docs-site/REQ-400.feature kind=functional status=Implemented test=tests/unit/rc8-site.test.ts -->

### Requirement: REQ-401 — A candidate's pages say they are a candidate

The system SHALL, when the site is built with `--channel next`, show on every page a banner saying it documents a release candidate with a link to the stable documentation one folder up, mark the candidate as current in the picker, and point the page's edit link at the `next/1.0` branch.

#### Scenario: SCN-401a — A reader on the candidate's pages

- GIVEN the site is built with `--channel next --versions stable=0.27.9,next=1.0.0-rc.8` into `next/`
- WHEN the reader opens `workspace.html`
- THEN the banner names the candidate and links to `../docs.html`, the picker marks v1.0.0-rc.8 as current, and the edit link contains `/edit/next/1.0/`

<!-- specgate:trace actor=Developer feature=features/docs-site/REQ-401.feature kind=functional status=Implemented test=tests/unit/rc8-site.test.ts -->

### Requirement: REQ-402 — The new features of 1.0, page by page

The system SHALL publish `docs/whats-new-1.0.md` in the sidebar, explaining each feature 1.0 adds, and it SHALL name every release candidate that has a `## [1.0.0-rc.N]` section in CHANGELOG.md.

#### Scenario: SCN-402a — The page keeps up with the changelog

- GIVEN CHANGELOG.md has sections for 1.0.0-rc.1 to the latest candidate
- WHEN the site is built
- THEN `whats-new-1.0.html` exists, is in the sidebar, and names each of those candidates

<!-- specgate:trace actor=Developer feature=features/docs-site/REQ-402.feature kind=functional status=Implemented test=tests/unit/rc8-site.test.ts -->
