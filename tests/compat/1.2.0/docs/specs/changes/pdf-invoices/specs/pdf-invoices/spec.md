# Delta — pdf-invoices

## ADDED Requirements

### Requirement: REQ-001 — A paid invoice downloads as a PDF

The system SHALL let a customer download a paid invoice as a PDF.

#### Scenario: SCN-001a — A paid invoice

- GIVEN a paid invoice of the customer
- WHEN the customer downloads it
- THEN a PDF of the invoice is returned

<!-- specgate:trace actor=Customer kind=functional -->
