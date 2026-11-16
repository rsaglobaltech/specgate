# Domain Model

## Bounded Contexts

| ID | Name | Type | Responsibility | Aggregates |
|---|---|---|---|---|
| BC-001 | Core | Core | Own the central business rules. | AGG-001 CoreAggregate |

## Aggregates

| ID | Aggregate | Context | Invariants |
|---|---|---|---|
| AGG-001 | CoreAggregate | Core | Define the first consistency rules. |

## Value Objects

| ID | Value Object | Fields | Invariants |
|---|---|---|---|
| VO-001 | ExampleValue | value | Must be valid for the business process. |

## Domain Events

| ID | Event | Producer | Consumers | Payload |
|---|---|---|---|---|
| EVT-001 | ExampleEvent | CoreAggregate | TBD | occurred_at |

## Context Notes

- Keep domain logic independent from HTTP, database, queues, and framework code.
- Add structure only when it improves clarity, traceability, generation, review, or validation.
