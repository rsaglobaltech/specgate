# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-820 — Determining whether is no condition

<!-- specgate:trace actor=Product owner kind=functional -->

The system SHALL not read "si" after a verb of determining, evaluating, confirming, validating or reviewing ("determina si", "evalúa si", "confirma si", "valida si", "revisa si") — nor "if" after "determine", "evaluate", "confirm", "verify", "validate" or "find out" — as a condition placed last (B11); and SHALL still warn under B11 for a rule whose condition follows what must happen.

#### Scenario: SCN-820a — The operator determines whether

- GIVEN a module whose rule is "El operador determina si el reporte corresponde a un servicio municipal."
- WHEN the Product owner runs `specgate propose --from-brief --check`
- THEN no `B11_condition_last` is listed for it, and "La incidencia se cierra si el técnico la resuelve." still has one
