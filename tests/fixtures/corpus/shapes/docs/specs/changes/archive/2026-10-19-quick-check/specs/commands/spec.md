# Delta — commands

## ADDED Requirements

### Requirement: REQ-002 — The quick check is named in the agent guide

The system SHALL name the quick check in the generated guide. This wording replaces REQ-001's earlier text; an example of the guide reads:

```
REQ-999 — an example id that is not a requirement
```

#### Scenario: SCN-002a — The guide names the quick check

- GIVEN a repository with the module billing
- WHEN the developer generates the guide
- THEN the developer sees `tool verify <module> --level fast` as the quick check, and `tool ci-log` for a red build

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-003 — The log quotes what it read

The system SHALL quote the line it read when it reports a failure.

#### Scenario: SCN-003a — A quoted line with vague words in it

- GIVEN a build log whose last line is "TODO: something went wrong..."
- WHEN the developer asks for the condensed log
- THEN the developer sees the line "TODO: something went wrong..." under "Last line", and `etc` is not added

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
