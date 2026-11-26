# Design: progress-file

`scripts/lib/progress.ts`: `progress()` appends a line when SPECGATE_PROGRESS_FILE is set; `runLogged()` runs a stage with its output to a log the progress names. `apply`'s steps, `GateStages.set` and `startShell` call them. AC-1 → SCN-654a–c.
