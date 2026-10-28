Feature: Three papercuts on a first project

  @REQ-178 @SCN-178a
  Scenario: A first-person brief with one actor
    Given a brief with the one actor Fahrschüler, written "Soy hispanohablante… Quiero una web personal…"
    When the brief is checked
    Then no B9_actor_unnamed warning is given, and with a second actor Prüfer both are warned with a fix that names the first person

  @REQ-178 @SCN-178b
  Scenario: An edited prompt prefix survives harness init
    Given a project where `harness init` ran and `.harness/prompt-prefix.md` was then edited
    When the developer runs `specgate harness init --project-dir .`
    Then it exits 0, the prefix is unchanged, and the output says it was kept; with `--force` it is replaced

  @REQ-178 @SCN-178c
  Scenario: Validate without a directory
    Given any folder
    When the developer runs `specgate validate --strict`
    Then it exits 2 and stderr names `specgate validate . --strict`
