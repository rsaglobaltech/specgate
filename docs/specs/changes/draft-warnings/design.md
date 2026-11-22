# Design: draft-warnings

`DraftCommand` counted `report.status.length` — warnings included — in the draft, `--check`, the module's status and `openFindings`. `errorCount` counts only errors in all four; warnings are still printed. AC-1 → SCN-176c.
