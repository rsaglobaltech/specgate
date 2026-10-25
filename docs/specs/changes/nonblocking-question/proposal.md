# Proposal: nonblocking-question

## Intent

D7 refuses an open question that blocks no requirement, so a question for later that nothing in the draft is built around (an adopter's "should it export a backup?") had nowhere to go: the agent dropped it to get the draft to Ready to review, and it was lost. How to answer a question was documented in one sentence.

## Scope

A Blocks cell that says so on purpose (`none`, `—`, `ninguno`, `n/a`) makes the question a warning, `D7_question_blocks_nothing`, and nothing waits for it; an empty cell is still refused, and its fix now names `none`. `docs/from-a-brief.md` shows how to answer a question, step by step, and that Approved owes a test.

## Out of scope

Lifting `Needs Clarification` automatically when an answer is written: the person who answers decides the requirement is ready.
