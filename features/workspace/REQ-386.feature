Feature: A part that shares a criterion with the contracts cites them

  @REQ-386 @SCN-386a
  Scenario: The tracking part cites nothing of the contracts
    Given the story track-fleet gives AC-1 to contracts and to tracking, and tracking's REQ-002 cites nothing
    When the developer runs `specgate change validate track-fleet --json` in tracking
    Then it warns `layer_no_contract_cited` for REQ-002, with a fix naming `depends=contracts:REQ-NNN`, and no longer once the trace carries `depends=contracts:REQ-002` or an `api=`
