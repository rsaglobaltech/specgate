Feature: A DDD workshop's boards become the brief's modules

  @REQ-655 @SCN-655a
  Scenario: The claims workshop imported into an empty project
    Given a project with no brief, and the motor-claims workshop exported from dddtoolbox.com: its story, its Event Storming and the canvases Siniestros, Pólizas and Pagos
    When the Developer runs `specgate brief import` with the five files
    Then `docs/brief/models/siniestros.yaml`, `polizas.yaml` and `pagos.yaml` are written, the brief's front matter lists the modules siniestros, polizas and pagos and the actor Tramitador on web and Sistema de pagos on api, and the brief's workshop section names Siniestros with `docs/brief/models/siniestros.yaml`; and `propose --from-brief --check` finds the brief ready

  @REQ-655 @SCN-655b
  Scenario: An existing brief kept
    Given a project whose brief has the module catalogo and its own text
    When the Developer imports the claims workshop
    Then the brief still has catalogo and every line it had, and also the three modules of the workshop
