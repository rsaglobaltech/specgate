Feature: The studio's next step during onboarding says adopt, then specify

  @REQ-474 @SCN-474a
  Scenario: An existing project adopted from the studio
    Given a local Node project with code under `src/auth`, `src/catalog`, `src/orders` and `src/payments`, and no specgate files
    When the developer opens it in the studio, follows the next step to Adopt and adopts it
    Then Home first says "Adopt this folder", not "Create the project", and after adoption "Specify a behaviour you rely on" with "4 areas in docs/specs/adoption.md"
