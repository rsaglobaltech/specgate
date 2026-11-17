Feature: The actors drawn without a brief, and kept current

  @REQ-594 @SCN-594a
  Scenario: A project with requirements and no brief
    Given a project with no brief and requirements whose actor is Customer, Clerk and customer
    When the person runs `specgate check`
    Then `docs/specs/actors.md` draws Customer and Clerk, with the third requirement under Customer, and check says it regenerated it

  @REQ-594 @SCN-594b
  Scenario: Nothing names an actor
    Given a project with no brief and no requirement with an actor
    When the person runs `specgate check`
    Then check says `docs/specs/actors.md` is not drawn, and why
