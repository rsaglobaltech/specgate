# Design: rc4-ticks

> Owner: architect — modules, mechanisms, channels.

## Mechanisms

- AC-1 — `onlyTaskTicksChanged` (packages/core WriteScope) reads a `git diff -U0` of a change's tasks.md: every changed line is a
  task whose text, with its box read as open, is the same before and after. The harness's write-scope check leaves such a file out,
  as it does a trace whose only change is its status. The implementing prompt says the harness ticks the tasks itself.
- AC-2 — any other difference in tasks.md (text, an added or a removed line) keeps the file a protected edit.
- AC-3 — the stories front matter is split on the commas outside brackets and quotes.
