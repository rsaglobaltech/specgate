Feature: A map of where each requirement lives

  @REQ-678 @SCN-678a
  Scenario: The route from an end-to-end test
    Given a project with `app_url: http://localhost:5173`, REQ-031 "Cancel an order" with `uc='UC-002 Cancel an order'`, and `e2e/cancel.spec.ts` naming REQ-031 that opens `page.goto("/orders/A-1")`
    When the Developer runs `specgate map REQ-031 --json`
    Then REQ-031 has `route` "/orders/A-1", `routeFrom` "e2e", `url` "http://localhost:5173/orders/A-1", `useCase` "UC-002 Cancel an order" and `e2e` ["e2e/cancel.spec.ts"]

  @REQ-678 @SCN-678b
  Scenario: The route the trace gives, and a requirement still in its change
    Given REQ-031 with `route=/orders/:id` in its trace, and REQ-040 added by the open change draft-pagos with no route
    When the Developer runs `specgate map --json`
    Then REQ-031 has `route` "/orders/:id" and `routeFrom` "trace", and REQ-040 is listed with `route` null and `routeFrom` null
