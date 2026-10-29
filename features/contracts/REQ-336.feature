Feature: One command compares contracts and requirements

  @REQ-336 @SCN-336a
  Scenario: One operation without a requirement
    Given openapi.yaml has `POST /positions` and `GET /positions/{id}`, and only REQ-002 cites `reportPosition`
    When the developer runs `specgate contract check --json`
    Then it exits 0 and names `GET /positions/{id}` as not cited by any requirement
