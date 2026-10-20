Feature: Warnings make each rule testable

  @REQ-138 @SCN-138a
  Scenario: Three warnings, no error
    Given `non_goals: [payments]` and a courses section with the rules "Joining is refused if the course is full", "Teachers can see payments of a course" and "Courses are stored in PostgreSQL", and an example for each
    When the developer runs `specgate propose --from-brief --check`
    Then it exits 0 and shows `B11_condition_last` for the first rule, `B10_non_goal` for the second and `B7_technical` for the third
