Feature: A dependency the design names is carried by a requirement

  @REQ-380 @SCN-380a
  Scenario: The panel's design names what it waits for
    Given a layered change whose design.md has the row "REQ-002 — `depends=tracking:REQ-002`" and whose REQ-002 trace carries no depends
    When `specgate change validate` runs
    Then it warns layer_design_dependency_untraced for tracking:REQ-002, naming REQ-002

  @REQ-380 @SCN-380b
  Scenario: The dependency is in the trace
    Given the same change, with `depends=tracking:REQ-002` in REQ-002's trace
    When `specgate change validate` runs
    Then it gives no layer_design_dependency_untraced warning
