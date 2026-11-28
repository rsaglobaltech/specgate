Feature: The evidence as one web page

  @REQ-818 @SCN-818a
  Scenario: One page, pictures inside
    Given draft-orders whose REQ-031 has a before and an after, each with a screenshot
    When the Developer runs `specgate evidence draft-orders --html`
    Then EVIDENCE.html exists beside EVIDENCE.md, holds both screenshots as `data:image/png;base64` and REQ-031's title, loads Mermaid from `cdn.jsdelivr.net/npm/mermaid@`, and names no file it needs beside it
