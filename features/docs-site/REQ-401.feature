Feature: A candidate's pages say they are a candidate

  @REQ-401 @SCN-401a
  Scenario: A reader on the candidate's pages
    Given the site is built with `--channel next --versions stable=0.27.9,next=1.0.0-rc.8` into `next/`
    When the reader opens `workspace.html`
    Then the banner names the candidate and links to `../docs.html`, the picker marks v1.0.0-rc.8 as current, and the edit link contains `/edit/next/1.0/`
