Feature: The requirement's code as a UML class diagram

  @REQ-811 @SCN-811a
  Scenario: A use case and its port
    Given `ReviewOrder.java`, which names REQ-041, holding a `private final Classifier classifier` and `public Mono<Decision> execute(String text)`, `Classifier` an interface implemented by `AiClassifier`, and `Decision` an enum `ALLOW, DENY`
    When the evidence diagrams of REQ-041 are drawn
    Then the class diagram shows `ReviewOrder --> "1" Classifier : classifier`, `Classifier <|.. AiClassifier`, `+execute(text : String) Mono~Decision~` and `Decision` as `<<enumeration>>` with `ALLOW` and `DENY`
