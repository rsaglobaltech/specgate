Feature: A customer does not administer

  @REQ-601 @SCN-601
  Scenario: A customer does not administer
    Given "ana@shop.test" signed in as a customer
    When she POSTs /api/admin/products
    Then the response is 403
