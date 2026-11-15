Feature: A client's text outside the project proposed as a form

  @REQ-488 @SCN-488a
  Scenario: The proposed front matter has a problem
    Given a project in git and the client's text in a file outside it
    When `specgate propose --from-brief --brief <that file> --agent <cmd> --json` runs and the agent proposes a front matter whose actor uses a surface `surfaces` does not list
    Then the answer gives the form with the proposed product and modules and the problem under `status`, and the project's files and `git status` are as before
