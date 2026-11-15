Feature: A change is a reviewable folder

  @REQ-100 @SCN-100a
  Scenario: Crear un cambio
    Given un proyecto spec-driven sin cambios activos
    When el usuario ejecuta `specgate change new add-dynamic-pricing`
    Then se crea el directorio del cambio con `discover.md`, `design.md`, `tasks.md` y `change.yaml`
    And se reserva un rango de identificadores REQ que ningún otro cambio puede usar
