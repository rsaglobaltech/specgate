Feature: The glossary's missing terms, suggested

  @REQ-595 @SCN-595a
  Scenario: A customer the glossary does not define
    Given a project whose requirement names the actor Customer and whose glossary is empty
    When the person runs `specgate glossary`, then `specgate glossary --write`
    Then the first lists Customer and writes nothing, the second adds the row `| Customer |  |  |`, and Customer is no longer suggested
