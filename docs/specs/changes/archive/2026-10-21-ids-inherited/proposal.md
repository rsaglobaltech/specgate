# Proposal: ids-inherited

## Intent

Found rehearsing two tickets that rewrite one requirement: once the first was merged into `develop`, the second branch failed `check` with `id_taken_on_base` for REQ-009 and was told to renumber it. The branch had not taken the id; it had inherited REQ-009 and `develop` had changed it. Renumbering would have broken every test that names REQ-009.

## Scope

REQ-120: an id collides only when this branch introduced it, that is when it is absent at the merge base of the branch and the base. A requirement both sides hold from before is concurrent editing, which REQ-160 and REQ-167 cover.
