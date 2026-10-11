# Capability — Ledger

Customer accounts whose money only moves through balanced, append-only journal entries. The balance is never stored: it is the sum of the postings. Pairs with the `transfers` pack.

Installed into {{PROJECT_NAME}} from a proven Specgate pack. Derived from the core-banking pilot (FinCore): implemented and tested in Spring Boot 3.3, Java 21 and PostgreSQL; 112 tests green. The pilot's code is private; its requirements and scenarios are what this pack carries.

### Requirement: REQ-101 — Open an account for a customer whose KYC is verified

<!-- csda:trace kind=functional -->

**Obligation (MUST).** A customer with verified KYC gets a current account in euros at once, with a zero balance, status "active" and its own IBAN. A customer whose KYC is not verified gets no account.

### Requirement: REQ-102 — Every account gets a valid IBAN (ISO 13616)

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** Each account is assigned an IBAN built from the country code, the two ISO 13616 check digits and the domestic account number, so that the IBAN modulo 97 is 1. The pilot issued Spanish IBANs (24 characters, fictitious bank code 9000).

Source: ISO 13616-1:2020, Financial services — International bank account number (IBAN) — https://www.iso.org/standard/81090.html

### Requirement: REQ-103 — Deposit cash into an active account

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** An operator deposits a positive amount in euros, with a description, into an active account. A zero or negative amount is refused.

### Requirement: REQ-104 — Double entry, balanced and immutable

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** Every movement of money is a journal entry whose debit postings add up to its credit postings. An unbalanced entry is refused, and an entry already posted is never updated or deleted (the pilot enforced it with a database trigger as well as in the domain).

### Requirement: REQ-105 — The balance is derived from the ledger

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** The balance of an account is the sum of its credit postings minus the sum of its debit postings; it is never stored separately.

### Requirement: REQ-106 — Account statement, newest first

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** The holder sees the movements of the account from newest to oldest, each with its date, description, amount and the balance it left.

### Requirement: REQ-107 — Only the holder sees an account

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** A customer asking for the balance, the movements or the closure of an account that is not theirs gets the same answer as for an account that does not exist, so the API does not reveal which accounts exist.

### Requirement: REQ-108 — Block and unblock an account

<!-- csda:trace kind=functional -->

**Obligation (MUST).** An operator blocks an active account with a reason; a blocked account accepts no movements until an operator unblocks it. Unblocking an account that is not blocked is refused.

### Requirement: REQ-109 — Close an account only at a zero balance

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** The holder closes an active account whose balance is zero; closing an account with money in it is refused.

### Requirement: REQ-110 — A customer lists their own accounts

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** A customer sees all their accounts with IBAN, type, status and balance, in the order they were opened, and never another customer's. Found by running the pilot: after opening an account the customer had no way to read its IBAN again.

## Business rules

- **Money moves only through balanced journal entries.** No code path updates a balance directly.
- **IBANs satisfy ISO 13616 (modulo 97 = 1).** Source: ISO 13616-1:2020.
