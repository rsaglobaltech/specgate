Feature: A repository that has code, adopted from the studio

  @REQ-443 @SCN-443a
  Scenario: Adopting a repository with a README and code
    Given a folder with a README.md and src/index.js and no spec.md
    When Settings previews the adoption and then adopts it
    Then the preview lists spec.md among the files to write, and afterwards spec.md exists while README.md and src/index.js are unchanged
