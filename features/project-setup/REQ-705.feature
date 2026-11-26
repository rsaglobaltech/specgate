Feature: A profile for a module or a requirement, with one command

  @REQ-705 @SCN-705a
  Scenario: ausleihe given its own agent
    Given a project with the modules katalog and ausleihe
    When the Developer runs `specgate config set profiles.careful.agent "claude -p < {prompt_file}"` and `specgate config set profiles.careful.match.module ausleihe`
    Then `specgate harness doctor --no-probe --json` routes ausleihe's requirements to careful; and `config set profiles.careful.match.module pagos` is refused naming katalog and ausleihe
