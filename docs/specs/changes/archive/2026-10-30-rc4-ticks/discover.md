# Discover: rc4-ticks

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the third multi-repository run of truck-flote, a requirement of the web repository failed three times: the agent marked as done the
task it had just delivered, and the harness counted that as tampering with the contract (MS3-4). The same mark is what the harness
itself writes once a requirement is delivered. In the same run, the list of stories showed a quoted title cut at its first comma, with
the opening quote (MS3-1).

## Use case

1. An agent delivers a requirement and marks its task as done; its work is judged on the requirement, not refused for the mark.
2. A person lists the stories of the brief and reads each title as the client wrote it.

## Acceptance criteria

- AC-1: Marking a task as done, or as not done, is never a reason to refuse an attempt.
- AC-2: Rewording, adding or removing a task is still refused.
- AC-3: A story title with a comma is listed whole, without its quotes.
