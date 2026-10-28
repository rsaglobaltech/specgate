# Proposal: baseline-needs

## Intent

`quality baseline` runs only the checks that write SARIF. Maven's
`dependencies` reads the bill of materials that `sbom` writes (REQ-237), so on
truck-flote the baseline ran it without one: "not recorded — it wrote no
SARIF", and the 18 known vulnerabilities of the generated dependencies would
have failed the first harness attempt as if a change had added them.

## Scope

In scope:

- `needs: <check>` on a check: the check it reads the output of, run first by
  the baseline, `--accept` included.
- The Maven preset's `dependencies` needs `sbom`.

## Approach

`readQuality` accepts `needs`, naming an earlier check. The baseline runs each
target's needs, once, before it.
