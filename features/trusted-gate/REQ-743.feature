Feature: Step definitions changed after the code began fail the gate

  @REQ-743 @SCN-743a
  Scenario: Steps bent to the code
    Given REQ-002's steps recorded when src/fees.js was first written
    When features/step_definitions/fees.steps.js is changed, and the Developer runs `specgate apply REQ-002`
    Then apply fails with `steps_changed_after_code` naming features/step_definitions/fees.steps.js

  @REQ-743 @SCN-743b
  Scenario: Steps first
    Given REQ-002's step definitions written before any source file, and not changed since
    When the Developer runs `specgate apply REQ-002`
    Then the gate says nothing of the steps

  @REQ-743 @SCN-743c
  Scenario: A person looked
    Given the finding of SCN-743a
    When the Developer runs `specgate apply REQ-002 --steps-reviewed`
    Then REQ-002 is delivered, and its evidence says the steps were reviewed and by whom

  @REQ-743 @SCN-743d
  Scenario: Nothing recorded them
    Given REQ-002 delivered with no hook and no harness, its step definitions new in the working tree
    When the Developer runs `specgate apply REQ-002`
    Then apply passes, saying the steps were written in the same delivery as the code and were not reviewed
