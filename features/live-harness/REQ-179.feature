Feature: The live view reads like a CI run

  @REQ-179 @SCN-179a
  Scenario: Titles and modules in the live model
    Given a project whose open change draft-diario defines REQ-022 "Registrar una clase con su fecha", whose DRAFTING.md shows an example REQ-022 with a placeholder for its title, and harness events for REQ-022
    When the live model is read
    Then REQ-022 has the title "Registrar una clase con su fecha" and the module "diario"

  @REQ-179 @SCN-179b
  Scenario: The page is laid out as a CI run
    Given the live page
    When it is served
    Then it has the sidebar of requirements, the run's summary, the graph of jobs, the steps Agent, Specification, Architecture, Tests and Merge, and the log, loads nothing from another host and parses nothing from an event as HTML
