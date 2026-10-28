Feature: A new requirement for a module the brief already covers

  @REQ-192 @SCN-192a
  Scenario: A module already archived gets a change
    Given module fichas is listed in the brief and has no open change
    When `specgate brief add fichas "Subir de marcha paso a paso"` runs
    Then the brief gains the line under "Additions" with fichas and the date, and change fichas-additions is created with one ADDED requirement quoting "Subir de marcha paso a paso"

  @REQ-192 @SCN-192b
  Scenario: A module with an open change grows it
    Given module examen has the open change draft-examen
    When `specgate brief add examen "Situaciones de noche"` runs
    Then draft-examen gains an ADDED requirement quoting the text with the next free id of its range; with the range used up, it is refused saying how to grow it

  @REQ-192 @SCN-192c
  Scenario: An unknown module is refused
    Given the brief lists no module "garaje"
    When `specgate brief add garaje "x"` runs
    Then it is refused with the modules the brief lists, and nothing is written
