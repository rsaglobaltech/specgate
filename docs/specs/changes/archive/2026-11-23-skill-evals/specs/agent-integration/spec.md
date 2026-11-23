# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-686 — A skill examined: correct by the gate, good by the review

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-686.feature actor=Developer kind=functional -->

The system SHALL, on `specgate eval <skill> [--runs <n>] [--agent <cmd>] [--json]`, read `evals/<skill>/eval.yaml` and run each of its tasks `runs` times, in parallel up to `concurrency`, each run in a fresh copy of the task's fixture with its own git repository, handing the agent a prompt file that holds the skill's text and then the task's prompt; and SHALL score each run correct when `specgate check` passes in that copy, and good as the mean of the `architecture` and `quality` stages that ran and of the reviewer's score out of 10 when `reviewer` is set; reporting, per task and overall, the share of correct runs and the mean good score, and removing the copies.

> Phase 5 of the trust curve: skills examined, the gate as the objective judge.

#### Scenario: SCN-686a — Two tasks, three runs each

- GIVEN an exam of the skill `orders` with the tasks cancel and pay, three runs each, an agent that makes cancel's tests pass and leaves pay's failing, and a reviewer that scores 8
- WHEN the Developer runs `specgate eval orders --json`
- THEN cancel is correct in 3 of 3 runs and pay in 0 of 3, the exam is 50 % correct, and every run's good score counts the reviewer's 0.8

#### Scenario: SCN-686b — No exam

- GIVEN a project with no `evals/missing/eval.yaml`
- WHEN the Developer runs `specgate eval missing`
- THEN it refuses with `eval_not_found`, whose fix names the file to write

### Requirement: REQ-687 — Each exam kept per version of the skill, and compared

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-687.feature actor=Developer kind=functional -->

The system SHALL append each exam to `evals/<skill>/history.jsonl` with its date, the skill's version — the first 12 hex digits of the sha256 of its text —, its runs, its correct share and good score, and its tasks; and SHALL compare it with the last exam of another version of the skill, saying `better`, `worse` or `same` for correct and for good, a difference of 5 points or less being the same.

#### Scenario: SCN-687a — A new version that does worse

- GIVEN the skill `orders` examined at 100 % correct, then its text changed so that the agent fails half the tasks
- WHEN the Developer runs `specgate eval orders --json` again
- THEN the history holds both versions, and the result says correct is `worse` than the previous version, from 100 % to 50 %
