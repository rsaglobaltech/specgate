Feature: The live view shows the run's work queue and the agent's session

  @REQ-182 @SCN-182a
  Scenario: The adapter records the model, the context and the totals
    Given Claude Code's stream with an init line, a message streamed as two lines, a second message and a result with its usage and cost
    When it is piped through `specgate harness events --from claude`
    Then the events hold the model and its session, one usage line per message with its context and window, and the totals with cost and turns

  @REQ-182 @SCN-182b
  Scenario: The live model folds the session and gives the queue and totals
    Given a queue of three requirements and the events of one with a prompt, its model and usage lines between its steps
    When the live model is read
    Then the requirement carries its model, current and peak context, output, prompt size, steps without the session lines, and the run its queue and, once the session ends, its totals and cost

  @REQ-182 @SCN-182c
  Scenario: The prompt is kept for the view
    Given an attempt's prompt
    When it is kept
    Then it is read back from beside the git-ignored events

  @REQ-182 @SCN-182d
  Scenario: The sidebar is a work queue and the requirement has an Agent tab
    Given the live page
    When it is served
    Then its sidebar has Now, Needs attention, Up next and Finished recently, and the requirement an Agent tab that reads the prompt
