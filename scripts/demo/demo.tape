# VHS tape — the day-to-day spec-driven loop, with the harness as the star.
#
# Render with: bash scripts/demo/build-video.sh
# build-video.sh exposes `specgate`, drops in a deterministic stub agent (or
# wires opencode with --real-agent), pre-warms the pack cache, and exports
# the SPECGATE_* env vars this tape reads.

Output scripts/demo/out/demo.mp4
Output scripts/demo/out/demo.gif

Require specgate

Set Shell bash
Set FontSize 22
Set Width 1920
Set Height 1080
Set Padding 32
Set Margin 0
Set Theme "Catppuccin Mocha"
Set TypingSpeed 80ms
Set PlaybackSpeed 1.0

# ── Setup (hidden): isolated work dir ────────────────────────────────────────
Hide
Type "cd $(mktemp -d) && clear" Enter
Show
Sleep 1s

# ════════════════════════════════════════════════════════════════════════════
#  Intro — one sentence, then straight to the loop
# ════════════════════════════════════════════════════════════════════════════
Type "# Spec-driven delivery: specs lead, an AI agent implements, the gate decides." Enter
Sleep 3s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Scaffold the project + pull in the domain pack
# ════════════════════════════════════════════════════════════════════════════
Type "# 1. Scaffold the project from a small YAML config." Enter
Sleep 2s
Type "cat > smart-parking.yaml <<'EOF'" Enter
Type "PROJECT_NAME: Smart Parking" Enter
Type "PROJECT_SLUG: smart-parking" Enter
Type "PROJECT_TYPE: backend" Enter
Type "DOMAIN: parking operations" Enter
Type "STACK: Node 20, Express, PostgreSQL" Enter
Type "API_STYLE: REST with DTO boundaries" Enter
Type "TESTING: node:test" Enter
Type "EOF" Enter
Sleep 1.2s
Type "specgate init --config ./smart-parking.yaml --out . --no-git" Enter
Sleep 3s
Type "cd smart-parking" Enter
Sleep 800ms

Type "# 2. Pull in a versioned domain pack — the npm-install of spec-driven dev." Enter
Sleep 2s
Type "specgate specops add --pack-repo $SPECGATE_PACK_REPO --pack-version $SPECGATE_PACK_V1 \" Enter
Type "  --pack $SPECGATE_PACK_ID --cache-dir $SPECGATE_CACHE_DIR \" Enter
Type "  --var PROJECT_NAME='Smart Parking' --var PROJECT_SLUG=smart-parking --var DOMAIN='parking operations'" Enter
Sleep 4s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  See the work — plan is the task queue
# ════════════════════════════════════════════════════════════════════════════
Type "# 3. plan: every requirement, what is still missing (this is the task queue)." Enter
Sleep 2s
Type "specgate plan | head -18" Enter
Sleep 6s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Configure the harness — point it at an AI agent and a test command
# ════════════════════════════════════════════════════════════════════════════
Type "# 4. Configure the harness: which AI agent it should call, and the gate." Enter
Sleep 2s
Type "demo-write-harness-config" Enter
Sleep 1.5s
Type "cat harness.config.yaml" Enter
Sleep 4s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  THE HARNESS — the day-to-day loop, agent writes real code
# ════════════════════════════════════════════════════════════════════════════
Type "# 5. Initial commit, then let the harness implement one requirement." Enter
Sleep 2s
Type "git init -q && git add -A && git commit -qm 'initial: specs + pack'" Enter
Sleep 1.5s

Type "# specgate harness run --req REQ-000   ── plan → context → agent → verify → done" Enter
Sleep 2s
Type "specgate harness run --req REQ-000" Enter
Sleep 9s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Look at what the agent actually wrote
# ════════════════════════════════════════════════════════════════════════════
Type "# 6. The agent committed real code on its own branch — look at it." Enter
Sleep 2s
Type "git log --oneline harness/REQ-000 -3" Enter
Sleep 3.5s

Type "git switch harness/REQ-000 -q" Enter
Sleep 1s
Type "# The production code:" Enter
Sleep 1.2s
Type "cat src/health.js" Enter
Sleep 5s
Type "# The test it wrote:" Enter
Sleep 1.2s
Type "cat test/health.test.js" Enter
Sleep 6s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Prove it actually passes the gate
# ════════════════════════════════════════════════════════════════════════════
Type "# 7. Run the same gate the harness ran — the tests really pass." Enter
Sleep 2s
Type "node --test test/*.test.js" Enter
Sleep 4s
Type "# And the matrix is closed: REQ-000 is now Implemented." Enter
Sleep 2s
Type "grep REQ-000 docs/specs/traceability.md | head -1" Enter
Sleep 4s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Outro
# ════════════════════════════════════════════════════════════════════════════
Type "# Specs as executable contracts. Real code, real tests, every commit reviewable." Enter
Sleep 2s
Type "# Full guide: docs/tutorial.md" Enter
Sleep 4s
