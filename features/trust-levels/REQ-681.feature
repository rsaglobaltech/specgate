Feature: A reported bug opens a change that must reproduce it

  @REQ-681 @SCN-681a
  Scenario: A bug in catalogo
    Given a project with `trust: { catalogo: 4 }`, and the map reaching catalogo at `/products/:id`
    When the Developer runs `specgate reproduce fix-precio --capability catalogo --title "The price shows without its discount" --ticket KAN-21`
    Then the change fix-precio is a bug change, its requirement is titled "The price shows without its discount" with `repro=required`, its discover names KAN-21 and `/products/:id`, and catalogo is at level 3
