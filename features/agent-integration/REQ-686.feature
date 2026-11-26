Feature: A skill examined: correct by the gate, good by the review

  @REQ-686 @SCN-686a
  Scenario: Two tasks, three runs each
    Given an exam of the skill `orders` with the tasks cancel and pay, three runs each, an agent that makes cancel's tests pass and leaves pay's failing, and a reviewer that scores 8
    When the Developer runs `specgate eval orders --json`
    Then cancel is correct in 3 of 3 runs and pay in 0 of 3, the exam is 50 % correct, and every run's good score counts the reviewer's 0.8

  @REQ-686 @SCN-686b
  Scenario: No exam
    Given a project with no `evals/missing/eval.yaml`
    When the Developer runs `specgate eval missing`
    Then it refuses with `eval_not_found`, whose fix names the file to write
