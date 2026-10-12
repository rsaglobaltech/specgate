# Capability — Transfers

Moving money between accounts. Builds on an account ledger such as the `ledger` pack: every transfer is a balanced journal entry.

Installed into {{PROJECT_NAME}} from a proven Specgate pack. Derived from the core-banking pilot (FinCore): implemented and tested in Spring Boot 3.3, Java 21 and PostgreSQL (row locks with FOR UPDATE); 112 tests green. The pilot's code is private; its requirements and scenarios are what this pack carries.

### Requirement: REQ-201 — Internal transfer, all or nothing

<!-- specgate:trace kind=functional -->

**Obligation (MUST).** A customer transfers an amount from one of their accounts to another account at the same bank at once: the debit and the credit are recorded in the same journal entry, or neither is.

### Requirement: REQ-202 — No overdraft

<!-- specgate:trace kind=business-rule -->

**Obligation (MUST).** A transfer that would leave the source balance below zero is refused.

### Requirement: REQ-203 — Simultaneous transfers never spend the same balance

<!-- specgate:trace kind=business-rule -->

**Obligation (MUST).** Transfers leaving the same account are processed one after another, so two simultaneous transfers can never both spend the same money.

### Requirement: REQ-204 — The destination IBAN must be valid

<!-- specgate:trace kind=business-rule -->

**Obligation (MUST).** A transfer whose destination IBAN fails the ISO 13616 check is refused before any money moves.

Source: ISO 13616-1:2020, Financial services — International bank account number (IBAN) — https://www.iso.org/standard/81090.html

### Requirement: REQ-205 — A transfer to another bank is a pending SEPA transfer

<!-- specgate:trace kind=functional -->

**Obligation (MUST).** A transfer to an IBAN of another bank is accepted as a SEPA credit transfer: the amount leaves the source at once and the transfer stays "pending" until it is settled.

Source: European Payments Council, SEPA Credit Transfer Rulebook — https://www.europeanpaymentscouncil.eu/what-we-do/epc-payment-schemes/sepa-credit-transfer

### Requirement: REQ-206 — Settle a SEPA transfer, refunding a rejection automatically

<!-- specgate:trace kind=functional -->

**Obligation (MUST).** An operator records the settlement of a pending SEPA transfer: "accepted" completes it; "rejected" rejects it and refunds the amount to the source automatically. A settled transfer cannot be settled again.

### Requirement: REQ-207 — A repeated request does not duplicate a transfer

<!-- specgate:trace kind=business-rule -->

**Obligation (MUST).** Two transfer requests from the same customer with the same Idempotency-Key header are one transfer: the second returns the transfer already created and moves no money.

### Requirement: REQ-208 — Daily transfer limit per account

<!-- specgate:trace kind=business-rule -->

**Obligation (SHOULD).** A transfer that would take the amount sent from one account in one calendar day (in the bank's time zone, counting transfers not rejected) over the daily limit is refused. The limit is the bank's decision: the pilot used 10000.00 EUR.

### Requirement: REQ-209 — A customer reads their own transfers

<!-- specgate:trace kind=functional -->

**Obligation (SHOULD).** The customer who ordered a transfer sees its status, amount, source, destination and description, and lists their transfers newest first; any other customer gets the answer for a transfer that does not exist.

### Requirement: REQ-210 — Operators list the SEPA transfers waiting for settlement

<!-- specgate:trace kind=functional -->

**Obligation (SHOULD).** An operator lists pending SEPA transfers oldest first, with id, source, destination, amount and description. Found by running the pilot: settling needs the transfer id, and the operator had no way to obtain it.

### Requirement: REQ-211 — Every rejection has the same error body

<!-- specgate:trace kind=non-functional -->

**Obligation (SHOULD).** Any rejected request is answered with the body {"error": code}, including a body that is not valid JSON or a field of the wrong type. Found by running the pilot: malformed JSON leaked the framework's own error format.

## Business rules

- **Debits on one account are serialised.** The pilot locked the source account row (SELECT … FOR UPDATE) for the duration of the transfer.
- **A rejected SEPA transfer is refunded automatically.** The compensation is a new journal entry, not a deletion.
