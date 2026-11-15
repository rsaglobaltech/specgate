Feature: A requirement waits for the one it depends on in another repository

  @REQ-295 @SCN-295a
  Scenario: A dependency on another repository not delivered yet
    Given tracking's REQ-005 depends on contracts:REQ-000, which is Draft
    When the developer runs `specgate workspace check`
    Then it fails with "tracking:REQ-005 depends on contracts:REQ-000, which is Draft", and no longer once contracts:REQ-000 is Implemented
