Feature: Maven coverage instruments the project's own classes

  @REQ-250 @SCN-250a
  Scenario: A Spring Boot API whose group is eu.truckflote
    Given `apps/api/pom.xml` with `<groupId>eu.truckflote</groupId>` below its Spring Boot `<parent>`
    When `specgate quality init` writes the coverage check
    Then its command loads JaCoCo's agent with `includes=eu.truckflote.*`, and its report is still `apps/api/target/site/jacoco/jacoco.xml`
