Feature: The contracts repository writes its contracts, and the others cite them

  @REQ-382 @SCN-382a
  Scenario: Writing the contracts part, then the panel's
    Given a story across fleet, tracking and contracts, its sub-changes opened
    When `change author --artifact specs` is prepared in contracts, and then in tracking
    Then the contracts prompt asks for the contract file under contracts/ and `api=contracts/`, and the tracking prompt asks to cite `depends=contracts:REQ-NNN`
