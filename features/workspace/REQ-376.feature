Feature: A quoted story title is read whole

  @REQ-376 @SCN-376a
  Scenario: A quoted story title in the stories table
    Given `stories:` holds `{ id: plan-route, title: "Optimización de rutas, con restricciones de vehículo pesado", repos: [fleet] }`
    When a person runs `specgate workspace draft`
    Then the table shows plan-route with "Optimización de rutas", and no quote
