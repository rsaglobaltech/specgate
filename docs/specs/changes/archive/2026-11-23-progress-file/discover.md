# Discover: progress-file

## Context

The studio's task window shows each long command's stages and the line it is on. `apply` and `check` ran their stages with spawnSync and said nothing until they ended.

## Acceptance criteria

- AC-1: apply and check tell each stage as it starts and ends, and where its output goes as it comes.
