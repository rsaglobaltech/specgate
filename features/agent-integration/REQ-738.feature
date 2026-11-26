Feature: A self-approving tool is not run outside a sandbox

  @REQ-738 @SCN-738a
  Scenario: Refused without a sandbox
    Given `specgate compat run --tool opencode --level L0`
    When the Developer runs it
    Then it is refused with `compat_needs_sandbox` naming `--sandbox sbx`, and no agent starts

  @REQ-738 @SCN-738b
  Scenario: At the Developer's word
    Given `specgate compat run --tool opencode --level L0 --no-sandbox`
    When the Developer runs it
    Then the run starts, and the output says the agent can read what the Developer can
