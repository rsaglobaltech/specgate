# Delta — transition

## ADDED Requirements

### Requirement: REQ-560 — The review and the acceptance list the acceptance criteria

The system SHALL, for a change whose `discover.md` numbers acceptance criteria (`- AC-n: …`), show them in `specgate review`'s page under "Acceptance criteria", with the Discover's Context as the page's "Why", and list each as an unchecked item of `specgate acceptance`'s checklist, before the scenarios; a change without a Discover SHALL read as before, from its proposal.

#### Scenario: SCN-560a — A layered change reviewed and accepted

- GIVEN a change whose Discover says why in its Context and numbers AC-1 and AC-2
- WHEN a product owner runs `specgate review` then `specgate acceptance` on it
- THEN the page shows the Context under "Why" and both criteria under "Acceptance criteria", and the checklist has an unchecked item for each criterion

<!-- specgate:trace status=Implemented feature=features/transition/REQ-560.feature actor=Product kind=functional -->

## MODIFIED Requirements

### Requirement: REQ-542 — Release notes come from what was archived

The system SHALL, with `specgate release-notes <from>..<to> [--out <file>] [--json]`, list the changes archived between the two git refs, grouped by their kind (`Enhancement`, `Bug`, then changes with no kind), each with its intent — its Discover's Context, or a 0.x proposal's Intent — and the requirements it delivered with their titles; SHALL write Markdown to `--out` or to standard output; and SHALL refuse an unknown ref with `ref_unknown`.

#### Scenario: SCN-542a — One enhancement and one bug between two tags

- GIVEN a repository where the change `pdf-invoices` (kind `enhancement`, REQ-007) and the change `rounding` (kind `bug`, REQ-009) were archived between the tags `v1.0.0` and `v1.1.0`
- WHEN a tool runs `specgate release-notes v1.0.0..v1.1.0`
- THEN the output has an `Enhancements` section with `pdf-invoices` and REQ-007's title, then a `Fixes` section with `rounding` and REQ-009's title

<!-- specgate:trace status=Implemented feature=features/transition/REQ-542.feature actor=Developer kind=functional -->
