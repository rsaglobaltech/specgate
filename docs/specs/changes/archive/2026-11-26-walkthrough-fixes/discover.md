# Discover: walkthrough-fixes

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

On 2026-11-26 the documentation was followed literally, command by command,
in empty folders, the way a newcomer would. Besides pages that had to change,
it met four things the product itself got wrong:

1. `status` named `apply` as the next step for a change nobody had approved —
   a step `apply` then refuses.
2. A trace comment written over two lines, as the guides show it, lost its
   feature file: `apply` wrote its status over the first line only, and the
   archive gave the requirement a second feature file; the gate went red.
3. A sealed acceptance test stopped being checked once its change was
   archived, although the guide says the seal holds from then on.
4. A changed sealed test ended the gate with "Fix its delta", the wrong fix;
   sealed tests with no command failed the gate with no verdict line; the
   refusal of an agent's sealing omitted `--layer acceptance` from its fix.

## Use case

A newcomer follows the guides and every next step the product names works;
what a person approved stays guarded, and every failure names the fix that
clears it.

## Acceptance criteria

- AC-1: `status` names the approval as the next step of a change nobody approved.
- AC-2: a trace comment over several lines is read and rewritten whole: its fields survive `apply` and `archive`.
- AC-3: a sealed acceptance test of an archived change is still checked and guarded.
- AC-4: the gate's verdict for a changed approval or sealed test names the fix that clears it; `approve_needs_person` names the layer asked for.
