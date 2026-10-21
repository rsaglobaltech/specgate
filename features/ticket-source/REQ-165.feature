Feature: Opening a ticket's change publishes its reservation

  @REQ-165 @SCN-165a
  Scenario: A colleague sees the reservation at once
    Given two clones of one repository, and a colleague who has just opened PET-104 with `specgate propose --from-ticket PET-104.json --capability owners`
    When the developer, in the other clone, runs `git fetch` and looks at the colleague's branch
    Then that branch holds PET-104's change, with its `req_range`, in a commit "PET-104 docs(spec): open the change from the ticket"
