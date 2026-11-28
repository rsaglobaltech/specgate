Feature: The gate policy reads `link`

  @REQ-801 @SCN-801a
  Scenario: A value the policy does not know
    Given `.specgate/gate.yaml` with `link: tags`
    When the policy is read
    Then it has the problem "link `tags` is not mention or strict", and the fix names `link: strict`
