/** `specgate done` writes `status=` into a trace; that is not an edit to the contract (#56). */
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { onlyTraceStatusChanged } from "../../src/domain/WriteScope";

const diff = (before: string, after: string) =>
  `diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -31 +31 @@\n-${before}\n+${after}\n`;
const TRACE = "<!-- csda:trace feature=features/feedback/REQ-212.feature kind=business-rule -->";

test("#56: adding the status done writes is not a contract edit", () => {
  assert.equal(
    onlyTraceStatusChanged(
      diff(
        TRACE,
        "<!-- csda:trace status=Implemented feature=features/feedback/REQ-212.feature kind=business-rule -->"
      )
    ),
    true
  );
});

test("any other change to the trace, or to the text, still is", () => {
  assert.equal(
    onlyTraceStatusChanged(
      diff(
        TRACE,
        "<!-- csda:trace status=Implemented feature=features/other.feature kind=business-rule -->"
      )
    ),
    false
  );
  assert.equal(
    onlyTraceStatusChanged(diff("- ENTONCES no sale ningún correo", "- ENTONCES sale un correo")),
    false
  );
  assert.equal(onlyTraceStatusChanged(""), false);
});
