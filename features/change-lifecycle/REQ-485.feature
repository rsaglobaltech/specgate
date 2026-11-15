Feature: Drafting again hands the open notes to the agent

  @REQ-485 @SCN-485a
  Scenario: Two open notes, the agent changes one requirement
    Given `draft-orders` with N1 on REQ-001 addressed, and N2 on REQ-001 and N3 on REQ-002 open
    When `specgate propose --from-brief orders --agent <cmd> --json` runs and the agent changes REQ-001 only
    Then the agent's prompt carries N2 and N3 and not N1; `draft.notes` gives N2 and N3 as given, N2 as addressed and N3 as open; and review.md marks N2 addressed with REQ-001 before and after
