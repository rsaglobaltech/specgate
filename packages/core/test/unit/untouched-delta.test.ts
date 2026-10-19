import { test } from "node:test";
import * as assert from "node:assert/strict";
import { isUntouchedDelta, templateDelta } from "../../src/domain/ChangeTemplates";
import { PHRASES } from "../../src/domain/Language";

test("a delta as propose wrote it is untouched, in any project language", () => {
  for (const t of Object.values(PHRASES)) {
    assert.equal(isUntouchedDelta(templateDelta("billing", "REQ-007", t), "billing"), true);
    assert.equal(
      isUntouchedDelta(templateDelta("billing", "REQ-007", t).replace(/\n/g, "\r\n"), "billing"),
      true
    );
  }
});

test("one replaced placeholder makes it the author's, judged like any other", () => {
  const skeleton = templateDelta("billing", "REQ-007", PHRASES.en);
  assert.equal(
    isUntouchedDelta(skeleton.replace("<short name>", "Send an invoice"), "billing"),
    false
  );
  assert.equal(isUntouchedDelta(skeleton, "payments"), false);
  assert.equal(isUntouchedDelta("# Delta — billing\n", "billing"), false);
});
