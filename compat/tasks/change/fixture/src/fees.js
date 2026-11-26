// REQ-002: the late fee — 0.50 a day, never more than 10.00.
exports.lateFee = (daysLate) => Math.min(10, Math.max(0, daysLate) * 0.5);
