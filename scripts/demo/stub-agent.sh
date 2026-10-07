#!/usr/bin/env bash
#
# Deterministic stub "coding agent" used by the demo video.
#
# `specgate harness run` shells out to this script with the path to a prompt
# file as the single argument. A real agent (claude / opencode / aider)
# would read that prompt and write code; this stub knows one requirement —
# REQ-000 (the platform health endpoint scaffolded by `init`) — and writes
# real test + production code that genuinely makes `node --test` pass.
#
# It is intentionally narrow: just enough to make the demo show a real
# end-to-end pass. For anything else it prints a clear note and exits
# non-zero, so the harness gate fails honestly.
set -euo pipefail

PROMPT_FILE="${1:-}"
if [ -z "$PROMPT_FILE" ] || [ ! -f "$PROMPT_FILE" ]; then
  echo "[stub-agent] no prompt file passed" >&2
  exit 2
fi

REQ="$(grep -oE 'REQ-[0-9]+' "$PROMPT_FILE" | head -n1 || true)"
echo "[stub-agent] implementing $REQ from $PROMPT_FILE"

case "$REQ" in
  REQ-000)
    mkdir -p src test
    cat > src/health.js <<'JS'
"use strict";

// REQ-000 — Platform health endpoint.
// Returns the smoke-test payload the Gherkin scenario asserts on.
function health() {
  return { status: "UP" };
}

module.exports = { health };
JS
    cat > test/health.test.js <<'JS'
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { health } = require("../src/health");

// REQ-000 SCN-000 — mentioning the ids is the link.
test("REQ-000 SCN-000: GET /health reports the service as UP", () => {
  const res = health();
  assert.equal(res.status, "UP");
});
JS
    echo "[stub-agent] wrote src/health.js + test/health.test.js"
    ;;
  *)
    echo "[stub-agent] no canned implementation for $REQ — pass --real-agent to use opencode" >&2
    exit 1
    ;;
esac
