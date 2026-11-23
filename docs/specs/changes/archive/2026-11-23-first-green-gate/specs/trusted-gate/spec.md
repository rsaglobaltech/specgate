# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-610 — The CI job of a Python project installs what its tests need

The system SHALL, when `ci init` or `adopt` writes the CI job of a Python project, add before the gate `pip install -r <file>` for each of `requirements.txt`, `requirements-dev.txt`, `requirements-test.txt`, `dev-requirements.txt` and `test-requirements.txt` the repository has, `pip install -e .` when `pyproject.toml` declares a `[build-system]` — with its `dev`, `test`, `tests` or `testing` extra when it declares one — and `pip install pytest` when the test command runs pytest and none of those files names it; and SHALL, when `pyproject.toml` has a `[tool.poetry]`, `[tool.pdm]` or `[tool.uv]` table, write no install command and a comment naming that tool.

#### Scenario: SCN-610a — Only pytest is missing

- GIVEN a project with a `pyproject.toml` that declares no build system, whose test command is `pytest`
- WHEN the install commands are read
- THEN they are `pip install pytest`

#### Scenario: SCN-610b — What the repository states

- GIVEN a project with `requirements.txt`, a `requirements-dev.txt` naming pytest, and a `pyproject.toml` with a `[build-system]` and a `test` extra
- WHEN the install commands are read for the test command `pytest -q`
- THEN they are `pip install -r requirements.txt`, `pip install -r requirements-dev.txt` and `pip install -e ".[test]"`

#### Scenario: SCN-610c — In the job, and Poetry

- GIVEN the first project, and another whose `pyproject.toml` has `[tool.poetry]`
- WHEN the developer runs `specgate ci init --provider github` in each
- THEN the first job runs `pip install pytest` after `setup-python`, and the second has no install command and the comment `poetry manages this project`

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-610.feature actor=Developer kind=functional -->

### Requirement: REQ-611 — A delivery says everything to rewrite in one refusal

The system SHALL, when `validate --strict --delivering <id>` fails on the scenarios of the requirement being delivered, report in the same refusal that requirement's `requirement_template_obligation` when its obligation is still the sentence Specgate wrote, in text and in `--json`, unless the policy reports or skips the `requirements` rule.

#### Scenario: SCN-611a — Fresh from new

- GIVEN an adopted project and REQ-002 as `specgate new` wrote it, with a test that names it
- WHEN the developer runs `specgate apply REQ-002`
- THEN it is refused once, naming `scenario_placeholder_step` and `requirement_template_obligation`

#### Scenario: SCN-611b — Both rewritten

- GIVEN the same requirement with its scenario's steps and its obligation written
- WHEN the developer runs `specgate apply REQ-002`
- THEN REQ-002 is marked Implemented

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-611.feature actor=Developer kind=functional -->
