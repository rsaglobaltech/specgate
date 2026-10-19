Feature: Studio stays on the developer's machine

  @REQ-132 @SCN-132a
  Scenario: A request from another name
    Given `specgate studio` running with its defaults
    When a request arrives with `Host: attacker.example`
    Then it is refused with status 403, and the server listens on 127.0.0.1 only
