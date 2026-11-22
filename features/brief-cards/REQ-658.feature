@change:brief-domain-views
Feature: The project's domain model, to draw

  @REQ-658 @SCN-658a
  Scenario: From the claims workshop
    Given a project where the motor-claims workshop was imported
    When the Developer runs `specgate brief model --json`
    Then it answers `source: workshop` and three contexts, siniestros core with its outbound ACL to Pólizas "Consultar cobertura", its flow "Asegurado · Declarar siniestro · Siniestro declarado", and its story of 26 activities, the first by the Asegurado

  @REQ-658 @SCN-658b
  Scenario: From the specification, with no workshop
    Given a project with no workshop, a module pedidos whose draft has REQ-031 "Cancel an order" by the Customer with the scenario "Cancelled before shipping", and the use case UC-001 whose main flow has three steps
    When the Developer runs `specgate brief model --json`
    Then it answers `source: spec`, the context pedidos with the flow "Customer · Cancel an order · Cancelled before shipping", and the story of UC-001 with its three steps
