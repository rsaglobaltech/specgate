# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-811 — The requirement's code as a UML class diagram

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL draw on the evidence page, per language of a requirement's code, one Mermaid class diagram of the slice the requirement touches — the types of its files, the types they reference up to two steps away, the implementations of its interfaces, and the types that hold one of its types as an attribute — with, for Java and TypeScript, each attribute and operation typed and with its visibility, the stereotypes `interface`, `record`, `enumeration` (with its literals) and `abstract`, associations named by the attribute with multiplicity `1` or `0..*`, dependencies from operation signatures, generalizations and realizations; and SHALL colour the types not at the base and those whose members changed, naming them under the diagram; the same code giving the same text.

#### Scenario: SCN-811a — A use case and its port

- GIVEN `ReviewOrder.java`, which names REQ-041, holding a `private final Classifier classifier` and `public Mono<Decision> execute(String text)`, `Classifier` an interface implemented by `AiClassifier`, and `Decision` an enum `ALLOW, DENY`
- WHEN the evidence diagrams of REQ-041 are drawn
- THEN the class diagram shows `ReviewOrder --> "1" Classifier : classifier`, `Classifier <|.. AiClassifier`, `+execute(text : String) Mono~Decision~` and `Decision` as `<<enumeration>>` with `ALLOW` and `DENY`

### Requirement: REQ-812 — A scenario followed through the code as a UML sequence

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL draw a scenario whose WHEN names `METHOD /path`, or that goes through a screen whose web code calls `/api/...` beside the requirement's id, as a numbered Mermaid sequence diagram from the code: the actor, the web app when through a screen, and one lifeline per object from the endpoint the code declares (Spring `@*Mapping`, JAX-RS `@Path`) — each call with its parameters and types, each reply with the type it returns or its HTTP status, with activations — following the calls on attributes, parameters and locals into the project's types, an interface's only implementation in its place, up to four levels, drawing a collaborator from outside the project without entering it; and SHALL draw from the steps a scenario that reaches no declared endpoint.

#### Scenario: SCN-812a — From the endpoint to the port

- GIVEN `OrderController` mapped to `POST /api/orders` with `@ResponseStatus(HttpStatus.CREATED)`, calling `review.execute(text)`, and `ReviewOrder.execute` calling `classifier.classify(text)`
- WHEN REQ-041's scenario that sends `POST /api/orders` is drawn
- THEN the sequence has lifelines `:OrderController`, `:ReviewOrder` and `:AiClassifier`, the messages `execute(text : String)` and `classify(text : String)` in that order, and the reply `201 Created` to the actor

#### Scenario: SCN-812b — No endpoint in the code

- GIVEN a scenario that sends `POST /api/unknown`, which no controller declares
- WHEN it is drawn
- THEN the diagram is the one from its steps, with `participant S as System`
