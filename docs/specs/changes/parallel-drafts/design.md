# Design: parallel-drafts

`runConfinedAgent` writes `<git-dir>/specgate-drafting/<change>.json` (pid, started, ended) around a draft's agent, and skips the folders of the changes whose marks overlap its run, when it saves and when it undoes. Marks a day old are dropped. AC-1 → SCN-652a.
