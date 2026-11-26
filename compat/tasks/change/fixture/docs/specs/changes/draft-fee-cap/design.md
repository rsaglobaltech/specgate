# Design: draft-fee-cap

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`src/fees.js` owns the late fee: one function, `lateFee(daysLate, memberType)`. No other source file is added or changed.

## Mechanisms

AC-1 — `lateFee` caps its result at 5.00 when the member type is "child" and at 10.00 otherwise; a call without the type behaves as before.
