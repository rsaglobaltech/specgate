Feature: The IBAN of the third account

  @REQ-102 @SCN-103
  Scenario: The IBAN of the third account
    Given the bank code "9000", the branch "0001" and two accounts already open
    When the third account is opened
    Then its IBAN is "ES1690000001240000000003", it has 24 characters and it is 1 modulo 97
