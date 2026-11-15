Feature: The studio approves a change layer by layer

  @REQ-562 @SCN-562a
  Scenario: In a team, the proxy's user approves the layer of their role
    Given a change whose Discover is written, and `roles: { product: [luis@acme.eu] }`
    When Ana, then Luis, signed in through the proxy, approve the Discover
    Then Ana's approval is refused, Luis's is recorded as luis@acme.eu, and the studio offered Approve on the Discover to Luis only
