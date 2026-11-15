# Review Checklist

## Pre-Implementation Gates

- [ ] Requirement has an ID.
- [ ] Scenario has an ID.
- [ ] Scenario maps to a use case.
- [ ] Use case maps to a command or query.
- [ ] Command or query maps to an aggregate or read model.
- [ ] Domain events are listed when state changes matter.
- [ ] Traceability row is complete.

## Architecture Gates

- [ ] Domain logic is independent from HTTP, database, queues, and framework code.
- [ ] Controllers and adapters call application use cases, not repositories directly.
- [ ] Business rules live in domain entities, value objects, or domain services.
- [ ] ADRs exist for decisions that affect architecture boundaries.
