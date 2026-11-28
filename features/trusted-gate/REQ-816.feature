Feature: The page shows each call to the service, before and after

  @REQ-816 @SCN-816a
  Scenario: 500 then 422
    Given REQ-031's before trace with `POST /api/orders` answered 500, and its after trace with the same call answered 422 `{"code":"order_unclear"}`, and a `POST /api/session` answered `{"token":"abc"}`
    When the Developer runs `specgate evidence draft-orders`
    Then the page shows `POST /api/orders` with 500 before and 422 after, the after's body with `order_unclear`, and the session's token as `«hidden»`, never `abc`
