# Discover: draft-warnings

## Context

On pintamundo-ai the module seguridad-contenido was drafted well, yet `propose --from-brief` said "3 finding(s) to fix" and ended with 1: its only findings were three D7_question_blocks_nothing warnings, which REQ-176 says do not keep a draft from Ready to review. The studio ran two useless fix passes (about 50 s) and still reported the draft as failed.

## Acceptance criteria

- AC-1: a draft whose only findings are warnings is Ready to review, ends with 0, and its fix pass gets only its errors.
