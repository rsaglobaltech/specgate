Feature: The CI job of a Python project installs what its tests need

  @REQ-610 @SCN-610a
  Scenario: Only pytest is missing
    Given a project with a `pyproject.toml` that declares no build system, whose test command is `pytest`
    When the install commands are read
    Then they are `pip install pytest`

  @REQ-610 @SCN-610b
  Scenario: What the repository states
    Given a project with `requirements.txt`, a `requirements-dev.txt` naming pytest, and a `pyproject.toml` with a `[build-system]` and a `test` extra
    When the install commands are read for the test command `pytest -q`
    Then they are `pip install -r requirements.txt`, `pip install -r requirements-dev.txt` and `pip install -e ".[test]"`

  @REQ-610 @SCN-610c
  Scenario: In the job, and Poetry
    Given the first project, and another whose `pyproject.toml` has `[tool.poetry]`
    When the developer runs `specgate ci init --provider github` in each
    Then the first job runs `pip install pytest` after `setup-python`, and the second has no install command and the comment `poetry manages this project`
