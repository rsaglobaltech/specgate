Feature: Answering a question writes the answer and what it decides

  @REQ-188 @SCN-188a
  Scenario: The answer, its assumption and the requirements to revise
    Given draft-examen's Q6 is open, blocks REQ-049 and the last assumption is A27
    When `specgate answer Q6 "Königsbrücker Straße from the footbridge"` runs
    Then Q6's Answer holds the text and its Status is answered, assumptions.md gains A28 with the text, REQ-049 under "Used in", "Q6" as its reason and the status `to review`, and REQ-049 is listed to revise

  @REQ-188 @SCN-188b
  Scenario: A draft waits until the answer is in its spec
    Given A28 is `to review`
    When the draft checklist runs
    Then it fails, naming A28 and the command that marks it reviewed; and after `specgate answer Q6 --reviewed` it no longer fails for it

  @REQ-188 @SCN-188c
  Scenario: Ambiguous or deferred answers are refused
    Given two changes have a question Q2
    When `specgate answer Q2 "yes"` runs without `--change`, or `specgate answer Q6 "TBD"` runs
    Then the first is refused naming both changes, the second is refused as an answer that decides nothing, and nothing is written
