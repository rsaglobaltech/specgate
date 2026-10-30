Feature: The site names both versions at the top left

  @REQ-400 @SCN-400a
  Scenario: A reader picks the candidate
    Given the site is built with `--channel stable --versions stable=0.27.9,next=1.0.0-rc.8`
    When the reader opens `harness.html`, `case-studies/<page>.html` or the landing page
    Then the picker lists v0.27.9 as current and v1.0.0-rc.8 linking to `next/whats-new-1.0.html` from that page; built without `--versions`, the page shows the plain badge
