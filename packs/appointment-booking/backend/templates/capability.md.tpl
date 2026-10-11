# Capability — Appointment booking

Online booking for a local business with several calendars (for example hair and beauty), staffed by a number of seats per hour.

Installed into {{PROJECT_NAME}} from a proven Specgate pack. Derived from the Bookings pilot: implemented and tested in TypeScript (Next.js with a hexagonal core) on PostgreSQL. The pilot's code is private; its requirements and scenarios are what this pack carries.

### Requirement: REQ-501 — Several calendars per business

<!-- csda:trace kind=functional -->

**Obligation (MUST).** The owner creates several calendars for their business, each with its own name, services and availability.

### Requirement: REQ-502 — Seats available per hourly slot

<!-- csda:trace kind=functional -->

**Obligation (MUST).** For each calendar and each one-hour slot, the owner sets how many seats (people or chairs) are available. A slot with no seats set is closed: it is neither offered nor bookable.

### Requirement: REQ-503 — Free start times for a service

<!-- csda:trace kind=functional -->

**Obligation (MUST).** For a service and a day, the customer sees the start times at which a seat is free for the whole duration of the service, within the business's lead time and advance limit.

### Requirement: REQ-504 — Book without an account

<!-- csda:trace kind=functional -->

**Obligation (MUST).** A customer books a free time giving name, email and phone, without creating an account, and receives a booking code.

### Requirement: REQ-505 — No booking above the seats, even at the same instant

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** A booking is refused when, in any slot it occupies, the bookings already made equal the seats available — including when two customers book the last seat at once.

### Requirement: REQ-506 — A service occupies every slot it touches

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** A booking counts in every hourly slot its duration touches: a 90-minute service starting at 10:30 takes a seat in the 10:00, 11:00 and 12:00 slots.

### Requirement: REQ-507 — Minimum lead time before an appointment

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** An online booking that starts sooner than the owner's lead time (in hours, from now) is refused. The minimum lead time is 1 hour.

### Requirement: REQ-508 — Maximum days in advance

<!-- csda:trace kind=business-rule -->

**Obligation (SHOULD).** An online booking further ahead than the owner's advance limit, in days, is refused.

### Requirement: REQ-509 — Cancel with the booking code

<!-- csda:trace kind=functional -->

**Obligation (MUST).** The customer cancels with the code they received until the lead time starts, and the slot becomes free again.

### Requirement: REQ-510 — The owner's agenda

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** The owner sees the bookings of any day in each calendar with time, service and customer details.

## Business rules

- **Capacity is checked per hourly slot, inside one transaction.** The pilot serialised bookings per calendar so the last seat is taken once.
