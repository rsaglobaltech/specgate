# Delta — orders

## ADDED Requirements

### Requirement: REQ-001 — Place an order

<!-- specgate:trace actor=Customer kind=functional -->

The system SHALL let a customer place an order.

> Brief: "Customers place orders."

#### Scenario: SCN-001 — A customer places an order

- GIVEN a customer with one item in the cart
- WHEN they send `POST /api/orders`
- THEN the response is 201 created

### Requirement: REQ-002 — Free shipping

<!-- specgate:trace actor=Customer kind=business-rule status="Needs Clarification" -->

The system SHALL not charge shipping above the free-shipping amount.

> Brief: "Shipping is free above some amount."

#### Scenario: SCN-002 — Free shipping above the amount

- GIVEN a customer with a cart above the free-shipping amount
- WHEN they send `POST /api/orders`
- THEN the response shows shipping 0

### Requirement: REQ-003 — Cancel an order

<!-- specgate:trace actor=Customer kind=functional status="Needs Clarification" -->

The system SHALL let a customer cancel an order.

> Brief: "An order can be cancelled."

#### Scenario: SCN-003 — A customer cancels

- GIVEN a customer with a placed order
- WHEN they send `POST /api/orders/1/cancel`
- THEN the response is 200
