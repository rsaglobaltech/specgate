# Delta — quality

## ADDED Requirements

### Requirement: REQ-798 — A trace value cut at a space is reported, and read alike everywhere

<!-- specgate:trace actor=Developer kind=functional feature=features/quality/REQ-798.feature -->

The system SHALL, when `specgate validate` finds in a requirement's `specgate:trace` an unquoted value followed by a word with no `=`, warn with the file, the line, what is read and the quoted form to write; and SHALL read a trace's `actor=` with the spec parser's rules wherever actors are listed or drawn, so a quoted actor keeps its spaces and loses its quotes.

> Reported on 2026-11-27: `actor=Adulto responsable` was stored as `Adulto` with no warning; and the domain view read `actor="Adulto responsable"` as `"Adulto`.

#### Scenario: SCN-798a — An unquoted actor with a space

- GIVEN a requirement whose trace says `actor=Adulto responsable kind=functional`
- WHEN `specgate validate` runs
- THEN it warns that `actor=Adulto responsable` is read as `actor=Adulto`, and to write `actor="Adulto responsable"`

#### Scenario: SCN-798b — A quoted actor

- GIVEN a requirement whose trace says `actor="Adulto responsable"`
- WHEN the domain view and the actors diagram read it
- THEN its actor is `Adulto responsable`, and `specgate validate` warns about nothing in it
