# Capability — Time and attendance

Clocking in and out on a jobsite in a way payroll can trust. Local labour law (meal breaks, overtime) is deliberately not in this pack.

Installed into {{PROJECT_NAME}} from a proven Specgate pack. Derived from the Rebar Crew pilot: implemented and tested in TypeScript (Expo mobile app, Next.js API, hexagonal core). The pilot's code is private; its requirements and scenarios are what this pack carries.

### Requirement: REQ-701 — Clock in only inside the jobsite's geofence

<!-- specgate:trace kind=functional -->

**Obligation (MUST).** A worker clocks in only when the device's location fix lies inside the geofence of a jobsite they are assigned to; outside it the clock-in is refused and the worker is told how far away they are.

### Requirement: REQ-702 — Clock out from anywhere, flagged outside the geofence

<!-- specgate:trace kind=functional -->

**Obligation (MUST).** A worker can always clock out — refusing it would inflate hours — but a clock-out outside the geofence is recorded with the flag OUTSIDE_GEOFENCE for review.

### Requirement: REQ-703 — A punch is immutable and carries its evidence

<!-- specgate:trace kind=business-rule -->

**Obligation (MUST).** A punch records worker, jobsite, type, device time, server receipt time, monotonic elapsed time, latitude, longitude and accuracy. It is never edited.

### Requirement: REQ-704 — Offline punches keep their real capture time

<!-- specgate:trace kind=functional -->

**Obligation (MUST).** Without network a punch is stored on the device with device time and monotonic elapsed time, and synced later. The server rebuilds the capture time from the monotonic clock and flags CLOCK_TAMPERED when the device time differs from it by more than 2 minutes.

### Requirement: REQ-705 — Supervisors review flagged punches

<!-- specgate:trace kind=functional -->

**Obligation (MUST).** A supervisor sees every flagged punch of their crews with its evidence and approves or rejects it with a reason. The decision is recorded; the punch is not edited.

### Requirement: REQ-706 — A correction is an approved adjustment, never an edit

<!-- specgate:trace kind=business-rule -->

**Obligation (MUST).** A missed or wrong punch is corrected by an adjustment stating the corrected time and a reason, approved by someone other than its author.

### Requirement: REQ-707 — A versioned geofence per jobsite

<!-- specgate:trace kind=functional -->

**Obligation (MUST).** An administrator sets each jobsite's geofence as a centre and a radius (default 100 m, allowed 30 to 1000 m). Changes are versioned, so past punches are judged against the geofence in force when they happened.

### Requirement: REQ-708 — Export timesheets for payroll

<!-- specgate:trace kind=functional -->

**Obligation (SHOULD).** An administrator exports approved timesheets per pay period as CSV; an unresolved flag holds back only its own row, which is reported.

## Business rules

- **Location is read only at punch time.** No background tracking of workers.
- **Local labour law is out of scope.** Meal breaks and overtime rules depend on the jurisdiction and belong to the adopting team.
