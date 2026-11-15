Feature: Every change, from proposal to archive

  @REQ-439 @SCN-439a
  Scenario: A delivered change archived from the studio
    Given the change `checkout` with every requirement Implemented, and the change `orders` with one still Draft
    When Changes is opened
    Then both are listed with their progress, `checkout` offers Archive with its preview and `orders` does not, and archiving `checkout` moves it to the archive
