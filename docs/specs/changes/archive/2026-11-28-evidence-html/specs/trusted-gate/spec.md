# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-818 — The evidence as one web page

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, on `specgate evidence <change> --html`, write `docs/specs/changes/<change>/EVIDENCE.html` beside `EVIDENCE.md`: one HTML document in English that opens with no server, holding the same evidence — each requirement's screens before and after as images inside the page (each up to 2 MB, a larger one named), its scenarios, calls to the service and AI decisions, each sequence diagram at the base and now side by side, its class diagrams — with Mermaid loaded from a pinned CDN build; and, on `--open`, which implies `--html`, SHALL open it in the browser, except when `CI` or `SPECGATE_NO_OPEN` is set.

#### Scenario: SCN-818a — One page, pictures inside

- GIVEN draft-orders whose REQ-031 has a before and an after, each with a screenshot
- WHEN the Developer runs `specgate evidence draft-orders --html`
- THEN EVIDENCE.html exists beside EVIDENCE.md, holds both screenshots as `data:image/png;base64` and REQ-031's title, loads Mermaid from `cdn.jsdelivr.net/npm/mermaid@`, and names no file it needs beside it
