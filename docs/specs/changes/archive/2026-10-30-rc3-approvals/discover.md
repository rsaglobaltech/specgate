# Discover: rc3-approvals

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the second run of the 1.0 candidate over several repositories, each repository delivered the first
requirement of its part and then refused the second one as "not approved", although nobody had changed
what was approved: delivering the first had only marked its task done. On Windows, two of four agents
writing a layer at once ended in an error after their work was written, only because a scratch file
could not be removed yet.

## Use case

A team approves its change once; the build delivers each of its requirements in turn, marking their
tasks done, and stops only when someone changes what was approved. Agents run side by side without a
cleanup turning finished work into a failure.

## Acceptance criteria

- AC-1: marking a task done, by the build or by a person, keeps the approval of the tasks.
- AC-2: any other edit of the tasks still asks for their approval again.
- AC-3: approvals recorded before this change keep counting.
- AC-4: a scratch file that cannot be removed yet never makes a command fail.
