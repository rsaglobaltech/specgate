# Proposal: truck-flote-run4

## Intent

The fourth truck-flote run, with Specgate 0.27.4 and forja 1.0.3, found:

- a command that starts with `./` — `./mvnw -B test`, the test command
  Specgate itself proposes for a Maven project — fails on Windows, where
  commands run in cmd.exe: "'.' is not recognized as an internal or external
  command" (S43; forja's own scripts had the same fault, F12);
- `specgate check` left `.specgate/` untracked — the pet's state and the
  `.gitignore` written beside it — so the tree was dirty after every check,
  and the harness wants a clean one (S42);
- the wording of REQ-252, "Its four fields that tell Specgate what to
  draft", has no verb (S41).

## Scope

The three above.
