Feature: Opening a ticket's change publishes its reservation

  @REQ-165 @SCN-165a
  Scenario: A colleague sees the reservation at once
    Given two clones of one repository, and a colleague who has just opened PET-104 with `specgate propose --from-ticket PET-104.json --capability owners`
    When the developer, in the other clone, runs `git fetch` and looks at the colleague's branch
    Then that branch holds PET-104's change, with its `req_range`, in a commit "PET-104 docs(spec): open the change from the ticket"

  @REQ-165 @SCN-165b
  Scenario: Another tool made the branch
    Given a colleague on a branch `feature/clinic/PET-104` that agentkit created, with another file staged, who runs `specgate propose --from-ticket PET-104.json --capability owners --no-branch`
    When the developer, in the other clone, runs `git fetch` and looks at `feature/clinic/PET-104`
    Then it holds PET-104's change in a commit "PET-104 docs(spec): open the change from the ticket", and the staged file is still staged, not in that commit
