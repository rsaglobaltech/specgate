Feature: Code under a folder named spec is not a test

  @REQ-675 @SCN-675a
  Scenario: A command folder named spec
    Given a project whose `scripts/commands/spec/Done.ts` and `tests/done.test.ts` both mention REQ-062
    When the Developer runs `specgate matrix --json`
    Then REQ-062's tests are `tests/done.test.ts` only, and its code names `scripts/commands/spec/Done.ts`

  @REQ-675 @SCN-675b
  Scenario: RSpec's spec folder
    Given a Ruby project whose `spec/models/order_spec.rb` and `spec/support/order_helper.rb` mention REQ-063
    When the Developer runs `specgate matrix --json`
    Then REQ-063's tests are both files
