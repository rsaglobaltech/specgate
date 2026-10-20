# Proposal: change-overlap

## Intent

With one change per ticket, two developers can rewrite the same requirement on two branches (KAN-13 and KAN-16 both modifying REQ-012). Nothing said so: the second pull request either conflicted in git or, worse, merged cleanly and silently replaced the first rewrite. Reserved ids (REQ-152, REQ-157) do not help here: the requirement already exists.

## Scope

In scope: a `change_overlap` warning from `check` and from the ticket draft report (REQ-160).

Out of scope: resolving the overlap; code conflicts, which git reports.
