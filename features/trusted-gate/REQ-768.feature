@change:guard-switch-person
Feature: Switching the guard off takes a person at a terminal

  @REQ-768 @SCN-768a
  Scenario: An agent's call
    Given a project with the guard on
    When `specgate config set agent_guard off` runs with no terminal
    Then it fails with `guard_needs_person`, and the guard is still on

  @REQ-768 @SCN-768b
  Scenario: A person at a terminal
    Given the same project
    When a person runs `specgate config set agent_guard off` at a terminal
    Then the guard is off
