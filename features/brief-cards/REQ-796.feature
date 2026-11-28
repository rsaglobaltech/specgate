Feature: The brief's guides are printed on request

  @REQ-796 @SCN-796a
  Scenario: The cards guide
    Given `docs/brief.md` whose front matter lists `courses` and `lessons`, and no `## Module:` section
    When `specgate propose --from-brief --guide cards` runs
    Then it prints the guide to propose the module sections, naming `courses` and `lessons`, and `docs/specs/BRIEF-CARDS.md` does not exist

  @REQ-796 @SCN-796b
  Scenario: The setup guide while the front matter has problems
    Given `docs/brief.md` whose front matter lists no module
    When `specgate propose --from-brief --guide setup` runs
    Then it prints the guide to propose the front matter, and `docs/specs/BRIEF-SETUP.md` does not exist

  @REQ-796 @SCN-796c
  Scenario: No module to write cards for
    Given `docs/brief.md` whose front matter lists no module
    When `specgate propose --from-brief --guide cards --json` runs
    Then it fails with `draft_guide_no_modules`, whose fix names `--guide setup`
