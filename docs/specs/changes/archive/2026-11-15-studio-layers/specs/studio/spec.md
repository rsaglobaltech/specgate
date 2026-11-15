# Delta — studio

## ADDED Requirements

### Requirement: REQ-562 — The studio approves a change layer by layer

The system SHALL show, in the studio's Changes, each written layer of a change (Discover, Design, Tasks) with the role that owns it, its approvals against its quorum and who gave them, and an Approve on each layer whose role the viewer holds; the viewer SHALL be the git identity of the project in a local studio and the user and e-mail the sign-in proxy names in a team's studio, and an approval SHALL be recorded for that viewer.

#### Scenario: SCN-562a — In a team, the proxy's user approves the layer of their role

- GIVEN a change whose Discover is written, and `roles: { product: [luis@acme.eu] }`
- WHEN Ana, then Luis, signed in through the proxy, approve the Discover
- THEN Ana's approval is refused, Luis's is recorded as luis@acme.eu, and the studio offered Approve on the Discover to Luis only

<!-- specgate:trace status=Implemented feature=features/studio/REQ-562.feature actor=Product kind=functional -->
