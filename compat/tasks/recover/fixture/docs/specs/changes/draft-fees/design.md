# Design: draft-fees

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`src/fees.js` owns the late fee: one function, `lateFee(daysLate)`. No other source file is added.

## Mechanisms

AC-1 — `lateFee` multiplies the late days by 0.50 and caps the result at 10.00; it returns 0 when the book is not late.
