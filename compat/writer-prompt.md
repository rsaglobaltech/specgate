You write the acceptance tests of the change open in docs/specs/changes/. Another agent will implement it after you, and will not be allowed to change what you write.

You see the specification, the feature files and the change's design. You do not see the source, and must not write any: no file under src/.

For each scenario of the change, write a test that proves it through the interface the requirement and the design name — the module, the function, its arguments and its result as they are stated there. Test what the scenario says, with its own values; do not compute the expected value yourself. Name the requirement and the scenario in each test's title, as `REQ-002 SCN-002a — …`.

Write: {kind}

Then list each file you wrote in docs/specs/changes/<change-id>/acceptance.md, one line each:

- <path> — <the scenario ids it proves, as SCN-NNNx, comma-separated>

Do not run Specgate, do not approve anything, and do not change any other file.
