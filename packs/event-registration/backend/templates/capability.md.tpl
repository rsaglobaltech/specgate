# Capability — Event registration

Attendees register for published events by ticket type. Quota and waitlist are decided inside one aggregate per event, so concurrency cannot oversell.

Installed into {{PROJECT_NAME}} from a proven Specgate pack. Derived from the event-operations pilot (EventTech): implemented and tested in Quarkus 3 with event sourcing on PostgreSQL; 38 of 38 requirements, 71 tests green. The pilot's code is private; its requirements and scenarios are what this pack carries.

### Requirement: REQ-301 — Ticket types with a quota

<!-- csda:trace kind=functional -->

**Obligation (MUST).** The organiser defines the ticket types of an event, each with a name and a quota greater than zero, and sees the seats left in each.

### Requirement: REQ-302 — Register for a published event

<!-- csda:trace kind=functional -->

**Obligation (MUST).** An attendee registers for a published event with name, email, ticket type and dietary restrictions; the registration is "confirmed" while the ticket type has quota. The same email cannot register twice for the same event, and an unpublished event cannot be registered for.

### Requirement: REQ-303 — Dietary restrictions come from a closed list

<!-- csda:trace kind=business-rule -->

**Obligation (SHOULD).** Only dietary restrictions on the organiser's closed list are accepted. The pilot's list: vegetarian, vegan, gluten-free, lactose-free, halal, kosher and nut allergy.

### Requirement: REQ-304 — Waitlist, promoted when someone cancels

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** Registering for a ticket type without quota leaves the attendee "waitlisted"; when a confirmed registration of that ticket type is cancelled, the first on its waitlist is confirmed.

### Requirement: REQ-305 — Simultaneous registrations never exceed the quota

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** Registrations for the same event are decided one after another, so two simultaneous registrations for the last seat confirm exactly one.

### Requirement: REQ-306 — An attendee sees their registrations

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** An attendee sees their registrations with the event, the ticket type, the status and their position on the waitlist when they are on it.

### Requirement: REQ-307 — Book a seat in a session

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** A confirmed attendee books a seat in a session of the event if its room has seats left and they hold no seat in an overlapping session.

### Requirement: REQ-308 — The organiser sees who registered

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** The organiser sees the registrations of their event with name, email, ticket type, status and dietary restrictions.

## Business rules

- **Quota and waitlist are decided in one aggregate per event.** The pilot appended facts under a per-event advisory lock, so two writers cannot both take the last seat.
