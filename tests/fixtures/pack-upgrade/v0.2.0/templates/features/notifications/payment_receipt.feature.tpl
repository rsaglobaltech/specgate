Feature: Driver Notifications
  Scenario: Sending receipt after successful payment
    Given ticket "TCK-1001" has been paid successfully
    And driver contact channel is "EMAIL"
    When payment confirmation workflow runs
    Then the system should send a payment receipt to the driver
