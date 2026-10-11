Feature: Creating a product

  @REQ-602 @SCN-602
  Scenario: Creating a product
    Given the administrator signed in
    When they create "Drill 500 W" in the category "Tools" at 49.90 EUR with 12 units
    Then the response is 201 and the product is in the catalogue
