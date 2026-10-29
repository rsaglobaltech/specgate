Feature: The business story stays put

  @REQ-287 @SCN-287a
  Scenario: The story rewritten during the design
    Given a layered change whose `discover.md` was committed with "AC-1: peak rate above 100 orders"
    When the working copy changes it to "AC-1: peak rate above 500 orders" and `specgate change validate` runs
    Then it warns `layer_discover_rewritten`, naming the commit the story was agreed at
