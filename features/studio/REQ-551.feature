Feature: A change reviewed by people who do not read the repository

  @REQ-551 @SCN-551a
  Scenario: A page that opens without a network
    Given an open change `pdf-invoices` with REQ-007, one scenario and one open question
    When a tool runs `specgate review pdf-invoices --out review.html`
    Then `review.html` holds REQ-007's title, its scenario's steps and the question, and has no `src` or `href` attribute pointing outside the file
