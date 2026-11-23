Feature: A bug in a module lowers its level at once

  @REQ-673 @SCN-673a
  Scenario: A bug escaped from catalogo
    Given a project with `trust: { catalogo: 4 }`
    When the Developer runs `specgate propose fix-precio --kind bug --capability catalogo`
    Then gate.yaml says `catalogo: 3`, the ledger ends with a `leak` line from 4 to 3 naming fix-precio, and the output says catalogo went down to 3
