#!/usr/bin/env bash
#
# build-video.sh (DE / Java edition) — record a polished 1080p German demo
# of the day-to-day spec-driven loop on a Java + Spring stack, using the
# PUBLISHED create-spec-driven-app@0.1.3 (so colleagues see exactly what
# they would get from `npx`).
#
# Agent modes:
#   --real-agent : shells out to opencode (`opencode run "$(cat
#                  {prompt_file})"`). Use this for the colleague demo.
#   default      : deterministic Java stub. Useful for CI / dry runs.
#
# Required tools:  vhs, node, git, mvn
# Optional:        ffmpeg, jq, curl + OPENAI_API_KEY  (voice-over)
#                  opencode  (only with --real-agent)
#
# Usage:
#   bash scripts/demo/de/build-video.sh --real-agent
#   OPENAI_API_KEY=sk-... bash scripts/demo/de/build-video.sh --real-agent
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEMO_DIR/../../.." && pwd)"
OUT_DIR="$DEMO_DIR/out"
mkdir -p "$OUT_DIR"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$1"; }
die()  { printf '\033[1;31m✖ %s\033[0m\n' "$1" >&2; exit 1; }

REAL_AGENT=0
for arg in "$@"; do
  case "$arg" in
    --real-agent) REAL_AGENT=1 ;;
    -h|--help) sed -n '1,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown flag: $arg" ;;
  esac
done

command -v vhs  >/dev/null 2>&1 || die "vhs not found — install from https://github.com/charmbracelet/vhs"
command -v node >/dev/null 2>&1 || die "node not found"
command -v git  >/dev/null 2>&1 || die "git not found"
command -v mvn  >/dev/null 2>&1 || die "mvn not found — install Maven"
[ "$REAL_AGENT" -eq 0 ] || command -v opencode >/dev/null 2>&1 || die "--real-agent requires opencode on PATH"

# Default to the LOCAL CLI from this checkout (so PR work is visible).
# Override with SPECGATE_CLI_PKG to record against a published version, e.g.
#   SPECGATE_CLI_PKG=create-spec-driven-app@0.1.4 bash scripts/demo/de/build-video.sh ...
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

WRAPPER_DIR="$SCRATCH/bin"
mkdir -p "$WRAPPER_DIR"

if [ -n "${SPECGATE_CLI_PKG:-}" ]; then
  step "CLI: npx $SPECGATE_CLI_PKG"
  cat > "$WRAPPER_DIR/specgate" <<EOF
#!/usr/bin/env bash
exec npx --yes $SPECGATE_CLI_PKG "\$@"
EOF
else
  step "CLI: local build from $REPO_ROOT"
  ( cd "$REPO_ROOT" && npm run build >/dev/null )
  cat > "$WRAPPER_DIR/specgate" <<EOF
#!/usr/bin/env bash
exec node "$REPO_ROOT/bin/specgate.js" "\$@"
EOF
fi
chmod +x "$WRAPPER_DIR/specgate"

# Stub agent on PATH (deterministic fallback when --real-agent is off).
cp "$DEMO_DIR/stub-agent.sh" "$WRAPPER_DIR/specgate-stub-agent"
chmod +x "$WRAPPER_DIR/specgate-stub-agent"
STUB_AGENT="$WRAPPER_DIR/specgate-stub-agent"

if [ "$REAL_AGENT" -eq 1 ]; then
  AGENT_CMD='opencode run "$(cat {prompt_file})"'
  step "Agent: opencode (real LLM)"
else
  AGENT_CMD="$STUB_AGENT {prompt_file}"
  step "Agent: deterministic Java stub"
fi

# Helper: seeds the minimal Maven pom + the Maven-friendly .gitignore line
# so the harness branch does not accidentally commit target/ artifacts.
cat > "$WRAPPER_DIR/demo-seed-pom" <<EOF
#!/usr/bin/env bash
set -e
cp "$DEMO_DIR/pom.xml.tpl" pom.xml
if ! grep -qx 'target/' .gitignore 2>/dev/null; then
  printf '\ntarget/\n' >> .gitignore
fi
echo "pom.xml geschrieben (+ target/ in .gitignore)"
EOF
chmod +x "$WRAPPER_DIR/demo-seed-pom"

# Helper: writes harness.config.yaml + .harness/prompt-prefix.md so the
# colleague demo shows the prompt_prefix feature in action.
cat > "$WRAPPER_DIR/demo-write-harness-config" <<EOF
#!/usr/bin/env bash
set -e
mkdir -p .harness
cat > .harness/prompt-prefix.md <<'PREFIX'
# Role
You are the Lead Technical Architect and Senior Backend Engineer.

# Active Project Boundary
- Current directory is the only scope. Do NOT scan siblings.

# Execution Policy
- Start coding. No planning-only output.
- Hexagonal architecture is non-negotiable (see AI_RULES.md).
- Never modify AI_RULES.md, spec.md, or features/**/*.feature.
PREFIX
cat > harness.config.yaml <<YAML
harness_version: 1
agent: '$AGENT_CMD'
test_cmd: 'mvn -q -B test'
max_attempts: 1
prompt_prefix_file: ./.harness/prompt-prefix.md
YAML
echo "harness.config.yaml + .harness/prompt-prefix.md geschrieben"
EOF
chmod +x "$WRAPPER_DIR/demo-write-harness-config"

export PATH="$WRAPPER_DIR:$PATH"
export SPECGATE_PACK_REPO="https://github.com/rsaglobaltech/parking-management-specops.git"
export SPECGATE_PACK_V1="v0.1.0"
export SPECGATE_PACK_ID="backend"
export SPECGATE_CACHE_DIR="$SCRATCH/cache"

# ── Warm npx cache + pack cache ──────────────────────────────────────────────
step "Warming npx and pack caches (one-time clones)"
WARM=$(mktemp -d)
( cd "$WARM" && \
  printf 'PROJECT_NAME="W"\nPROJECT_SLUG="w"\nPROJECT_TYPE="backend"\nDOMAIN="d"\nSTACK="s"\nAPI_STYLE="a"\nTESTING="t"\n' > w.config && \
  specgate init --config ./w.config --out . --no-git >/dev/null 2>&1 && \
  cd w && \
  specgate specops add --pack-repo "$SPECGATE_PACK_REPO" --pack-version "$SPECGATE_PACK_V1" --pack "$SPECGATE_PACK_ID" \
    --cache-dir "$SPECGATE_CACHE_DIR" --var PROJECT_NAME=W --var PROJECT_SLUG=w --var DOMAIN=d >/dev/null )

# Find the cached pack dir so the tape can run `pack lint --graph` against it.
CACHED_PACK_ROOT=$(find "$SPECGATE_CACHE_DIR" -name pack.yaml -path "*/backend/pack.yaml" | head -n1 | xargs -I{} dirname {} | xargs -I{} dirname {})
[ -n "$CACHED_PACK_ROOT" ] || die "could not locate cached pack root under $SPECGATE_CACHE_DIR"
export SPECGATE_GRAPH_PACK_ROOT="$CACHED_PACK_ROOT"
printf '  pack cache  : %s\n' "$CACHED_PACK_ROOT"

# ── Warm Maven cache so `mvn -o test` works offline during the recording ─────
step "Warming the Maven cache (downloads JUnit + Surefire once)"
( cd "$WARM" && cp "$DEMO_DIR/pom.xml.tpl" pom.xml && \
  mvn -q -B dependency:go-offline >/dev/null 2>&1 || \
  warn "mvn dependency:go-offline could not pre-warm everything — first mvn test may need network" )
rm -rf "$WARM"

# ── Record the demo ──────────────────────────────────────────────────────────
# Real opencode takes ~30–60 s per requirement; the stub finishes in <2 s.
# Substitute the placeholder Sleep accordingly so the tape waits long enough
# without dragging on for the stub case.
HARNESS_SLEEP="6s"
[ "$REAL_AGENT" -eq 1 ] && HARNESS_SLEEP="90s"
TAPE_TMP="$SCRATCH/demo.tape"
sed "s/%%HARNESS_SLEEP%%/$HARNESS_SLEEP/g" "$DEMO_DIR/demo.tape" > "$TAPE_TMP"

step "Recording the 1080p German demo with VHS (harness Sleep: $HARNESS_SLEEP)"
( cd "$REPO_ROOT" && vhs "$TAPE_TMP" )
[ -f "$OUT_DIR/demo.mp4" ] || die "VHS did not produce out/demo.mp4"
printf '  silent demo : %s\n' "$OUT_DIR/demo.mp4"
printf '  shareable   : %s\n' "$OUT_DIR/demo.gif"

# ── Optional German AI voice-over (OpenAI TTS) ───────────────────────────────
if [ -z "${OPENAI_API_KEY:-}" ]; then
  warn "OPENAI_API_KEY nicht gesetzt — Voice-over übersprungen. Stiller 1080p-Demo ist fertig."
  exit 0
fi
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  warn "ffmpeg / jq / curl fehlt — Voice-over übersprungen."
  exit 0
fi

step "Synthese der deutschen Voice-over (OpenAI TTS)"
VOICE="$(jq -r '.voice // "alloy"' "$DEMO_DIR/narration.json")"
AUDIO_DIR="$SCRATCH/audio"; mkdir -p "$AUDIO_DIR"
SEGMENTS=$(jq -r '.segments | length' "$DEMO_DIR/narration.json")
CONCAT_LIST="$AUDIO_DIR/concat.txt"; : > "$CONCAT_LIST"
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t 2.5 "$AUDIO_DIR/gap.mp3" >/dev/null 2>&1

for i in $(seq 0 $((SEGMENTS - 1))); do
  TEXT="$(jq -r ".segments[$i].text" "$DEMO_DIR/narration.json")"
  ID="$(jq -r ".segments[$i].id" "$DEMO_DIR/narration.json")"
  printf '  • %s\n' "$ID"
  curl -sS https://api.openai.com/v1/audio/speech \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$TEXT" --arg v "$VOICE" \
           '{model:"gpt-4o-mini-tts", voice:$v, input:$t, response_format:"mp3"}')" \
    -o "$AUDIO_DIR/$i.mp3"
  if head -c 4 "$AUDIO_DIR/$i.mp3" | grep -q '{' ; then
    die "OpenAI TTS Fehler bei Segment '$ID': $(cat "$AUDIO_DIR/$i.mp3")"
  fi
  echo "file '$AUDIO_DIR/$i.mp3'"  >> "$CONCAT_LIST"
  echo "file '$AUDIO_DIR/gap.mp3'" >> "$CONCAT_LIST"
done

step "Voice-over auf das Video legen"
ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" -c copy "$AUDIO_DIR/voice.mp3" >/dev/null 2>&1
ffmpeg -y -i "$OUT_DIR/demo.mp4" -i "$AUDIO_DIR/voice.mp3" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k \
  "$OUT_DIR/demo-narrated.mp4" >/dev/null 2>&1
printf '  narrated    : %s\n' "$OUT_DIR/demo-narrated.mp4"
step "Fertig."
