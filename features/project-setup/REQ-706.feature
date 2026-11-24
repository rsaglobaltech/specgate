@change:config-agents
Feature: The sandbox, set with one command per field

  @REQ-706 @SCN-706a
  Scenario: A swarm in sbx, set from the command line
    Given a project with no sandbox
    When the Developer sets `sandbox.engine sbx`, `sandbox.kit opencode`, `sandbox.allow "registry.npmjs.org, opencode.ai"` and `sandbox.setup "sh scripts/sandbox-setup.sh"`
    Then harness.config.yaml's sandbox reads engine sbx, kit opencode, the two hosts and the setup; and `config set sandbox.engine lxc` is refused
