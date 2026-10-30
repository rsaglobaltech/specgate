Feature: A placeholder operation is no citation

  @REQ-391 @SCN-391a
  Scenario: An operation placeholder after a real file is no reference
    Given the design of panel quotes `api=contracts/fleet-tracking.openapi.yaml#<operationId>`
    When the developer runs `specgate change validate panel --json`
    Then no `layer_design_dependency_untraced` is reported
