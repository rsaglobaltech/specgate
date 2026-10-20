# Proposal: base-moved

## Intent

Found rehearsing two tickets, PET-103 and PET-104, that both rewrite REQ-009. `change_overlap` (REQ-160) warns while both are open. Once PET-103 merged, PET-104's branch brought `develop` in, the warning was gone, the gate was green, and archiving PET-104 would have replaced REQ-009 with its own rewrite of the old text: PET-103's rule lost, with no conflict anywhere. The capability spec merge driver (REQ-166) only conflicts when both rewrites meet in one merge.

## Scope

A fingerprint of each requirement a change rewrites, recorded the first time the gate sees the change; `check` warns and `archive` refuses when the requirement moved under it; `change validate --rebased` records the new text once the delta is rewritten. Before the branch catches up, `check` compares the base with the merge base, so the warning comes before the merge.

## Out of scope

A change whose first check happens after the requirement already moved: there is no earlier text to compare with. `change_overlap` covers that window while both changes are open.
