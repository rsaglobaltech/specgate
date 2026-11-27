# Discover: brief-quotes

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The drafting guide tells the agent to quote, under every requirement, the
sentence of the brief it comes from. A project run on 2026-11-27 had REQ-011
quote «Recuperación de acceso.» and state the opposite of the brief, and the
draft was Ready to review: nothing read the quote back. The person reviewing
trusts the quote as the link to what the client wrote.

## Use case

The agent drafts a module; a quote that is not in the brief is reported like
any other finding, and the draft is not ready until it quotes the brief.

## Acceptance criteria

- AC-1: a quote that is not in the brief is a checklist error, at its line.
- AC-2: wrapping, case, quote marks, emphasis and the closing full stop do not make a true quote fail.
