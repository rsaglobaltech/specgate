# Discover: walkthrough-fixes-2

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A second literal walkthrough of the guides, on 2026-11-26, met six things the
product got wrong:

1. `agents init --tool claude-plugin`, run in a project, wrote the plugin's
   scripts at the project's root; the guard then read them as untested source
   and refused every call, an `ls` included.
2. `harness run --req` on a requirement waiting for an answer started an
   attempt and made its branch.
3. Once the client answered a question, approving the change again was
   refused: the answer's value was "not in the brief".
4. A ready draft, `propose` and `status` named `apply` next, before anyone
   approved it.
5. `check --base` on a branch that changed nothing named a sealed test as
   changed.
6. `specops diff` succeeded when a pack could not be rendered, and `specops
   sync` wrote a pack's requirement over an id the project already used, and
   said there was no conflict.

## Use case

A newcomer follows the guides and nothing the product says contradicts what
happens next.

## Acceptance criteria

- AC-1: the Claude Code plugin generated in a project lives where the guard never reads it as source.
- AC-2: a requirement waiting for an answer is never handed to an agent.
- AC-3: a client's answer to a question is a source for the values of the requirements it blocks.
- AC-4: a ready draft names the approval as its next step until a person gave it.
- AC-5: a branch that changes no control is reported as changing none.
- AC-6: a pack that cannot be rendered fails `specops diff`; an id clash fails `specops sync`.
