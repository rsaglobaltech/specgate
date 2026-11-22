@change:quoted-actor-names
Feature: An actor's name in quotes is read whole

  @REQ-622 @SCN-622a
  Scenario: A quoted name with a comma
    Given a brief whose actors include `- { name: "Padre, madre o tutor", surfaces: [web] }`
    When specgate checks the brief
    Then "Padre, madre o tutor" is one actor on web, and no `brief_actor_without_surfaces` is reported

  @REQ-622 @SCN-622b
  Scenario: The form writes such a name in quotes
    Given the form's actor "Padre, madre o tutor" on web
    When the form is written back to the brief
    Then the line reads `- { name: "Padre, madre o tutor", surfaces: [web] }`, and reading it back gives the same actor
