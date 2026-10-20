Feature: The front matter's shapes are reported as shapes

  @REQ-135 @SCN-135a
  Scenario: A scalar surface and a bare actor
    Given a brief whose front matter says `surfaces: web` and `actors: [Admin]`
    When the developer runs `specgate propose --from-brief`
    Then it exits 1 with two `brief_wrong_shape` findings, one whose fix reads "surfaces: [web]" and one whose fix reads "- { name: Admin, surfaces: [web] }"
    And no finding says "There is no `actors:` list"
