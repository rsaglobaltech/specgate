# Capability — Shop orders

The order half of an online shop. Shipping costs are the merchant's decision and stay open.

Installed into {{PROJECT_NAME}} from a proven Specgate pack. Derived from the credit-shop pilot (credito_tienda): implemented and tested in TypeScript (Next.js with a hexagonal core) on PostgreSQL. The pilot's code is private; its requirements and scenarios are what this pack carries.

### Requirement: REQ-601 — Only the administrator manages the shop

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** Every new account is a customer; the account whose email matches the configured administrator email is the administrator; the administration screens and API are refused to everyone else.

### Requirement: REQ-602 — The administrator manages products

<!-- csda:trace kind=functional -->

**Obligation (MUST).** The administrator creates, edits and withdraws products with name, description, category, price and units in stock; a withdrawn product is no longer sold.

### Requirement: REQ-603 — The public catalogue

<!-- csda:trace kind=functional -->

**Obligation (MUST).** Any visitor sees the products in stock by category, with their price, and searches them by name.

### Requirement: REQ-604 — The cart and its total

<!-- csda:trace kind=functional -->

**Obligation (MUST).** A customer adds products to their cart, changes quantities and removes them, and always sees the total.

### Requirement: REQ-605 — Never sell more than the stock

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** Adding to the cart, or confirming an order, with more units of a product than it has in stock is refused.

### Requirement: REQ-606 — Confirm the order

<!-- csda:trace kind=functional -->

**Obligation (MUST).** The customer's cart becomes an order "pending payment" with a delivery address; the units are taken from stock and the cart is emptied. The customer sees their orders with their status.

### Requirement: REQ-607 — The administrator moves orders through their states

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** The administrator sees all orders, filtered by status, and moves them to "paid", "shipped", "delivered" or "cancelled".

### Requirement: REQ-608 — Cancelling returns the stock

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** The units of a cancelled order return to stock, and a delivered order cannot be cancelled.

### Requirement: REQ-609 — Shipping costs

<!-- csda:trace kind=business-rule status="Needs Clarification" -->

**Obligation (SHOULD).** The order adds the merchant's shipping costs and the cart shows them before the customer confirms. The rule is the merchant's decision: the pilot's client chose 4.95 EUR below 50.00 EUR of products and free shipping from 50.00 EUR, which is an example, not a default.

> **Open question.** This requirement is installed as *Needs Clarification*: `specgate done` refuses it until the answer is written down.

## Business rules

- **Stock is taken when the order is placed, and returned when it is cancelled.** Both happen in the same transaction as the status change.
