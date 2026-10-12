#!/usr/bin/env bash
#
# build-video.sh — record a focused 1080p demo of the day-to-day spec-driven
# loop, with the harness writing real code on screen.
#
# Two agent modes:
#   default     : a deterministic stub agent that writes real test +
#                 production code for REQ-000 (the scaffolded health
#                 endpoint). Offline, reproducible, runs in CI.
#   --real-agent: shells out to opencode for the same prompt the harness
#                 would hand any AI agent. Authentic, non-deterministic,
#                 needs opencode installed.
#
# Required:  vhs, node, git
# Optional:  ffmpeg, jq, curl + OPENAI_API_KEY   (for the voice-over)
#            opencode                            (only with --real-agent)
#
# Usage:
#   npm run demo:video
#   bash scripts/demo/build-video.sh            # deterministic stub agent
#   bash scripts/demo/build-video.sh --real-agent   # real opencode agent
#   OPENAI_API_KEY=sk-... bash scripts/demo/build-video.sh
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEMO_DIR/../.." && pwd)"
OUT_DIR="$DEMO_DIR/out"
mkdir -p "$OUT_DIR"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$1"; }
die()  { printf '\033[1;31m✖ %s\033[0m\n' "$1" >&2; exit 1; }

REAL_AGENT=0
for arg in "$@"; do
  case "$arg" in
    --real-agent) REAL_AGENT=1 ;;
    -h|--help)
      sed -n '1,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) die "Unknown flag: $arg" ;;
  esac
done

command -v vhs  >/dev/null 2>&1 || die "vhs not found — install from https://github.com/charmbracelet/vhs"
command -v node >/dev/null 2>&1 || die "node not found"
command -v git  >/dev/null 2>&1 || die "git not found"
[ "$REAL_AGENT" -eq 0 ] || command -v opencode >/dev/null 2>&1 || die "--real-agent requires opencode on PATH"

# ── 1. Build the CLI, expose a `specgate` wrapper pointing at this checkout ───────
step "Building the CLI from $REPO_ROOT"
( cd "$REPO_ROOT" && npm run build >/dev/null )

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

WRAPPER_DIR="$SCRATCH/bin"
mkdir -p "$WRAPPER_DIR"
cat > "$WRAPPER_DIR/specgate" <<EOF
#!/usr/bin/env bash
exec node "$REPO_ROOT/bin/specgate.js" "\$@"
EOF
chmod +x "$WRAPPER_DIR/specgate"

# Stub agent on PATH so harness.config.yaml can reference it by absolute path.
STUB_AGENT_SRC="$DEMO_DIR/stub-agent.sh"
[ -x "$STUB_AGENT_SRC" ] || chmod +x "$STUB_AGENT_SRC"
cp "$STUB_AGENT_SRC" "$WRAPPER_DIR/specgate-stub-agent"
chmod +x "$WRAPPER_DIR/specgate-stub-agent"
STUB_AGENT="$WRAPPER_DIR/specgate-stub-agent"

if [ "$REAL_AGENT" -eq 1 ]; then
  AGENT_CMD='opencode run "$(cat {prompt_file})"'
  step "Agent: opencode (real LLM)"
else
  AGENT_CMD="$STUB_AGENT {prompt_file}"
  step "Agent: deterministic stub (writes real REQ-000 code)"
fi

# Helper the tape calls to drop harness.config.yaml — the agent path /
# command lives in env and we cannot Type a YAML string with double quotes.
cat > "$WRAPPER_DIR/demo-write-harness-config" <<EOF
#!/usr/bin/env bash
set -e
cat > harness.config.yaml <<YAML
harness_version: 1
agent: '$AGENT_CMD'
test_cmd: 'node --test test/*.test.js'
max_attempts: 1
YAML
echo "wrote harness.config.yaml"
EOF
chmod +x "$WRAPPER_DIR/demo-write-harness-config"

export PATH="$WRAPPER_DIR:$PATH"
export SPECGATE_PACK_REPO="https://github.com/rsaglobaltech/parking-management-specops.git"
export SPECGATE_PACK_V1="v0.1.0"
export SPECGATE_PACK_ID="backend"
export SPECGATE_CACHE_DIR="$SCRATCH/cache"

# ── 2. Warm the pack cache so the recording does not wait on git clone ───────
step "Warming the pack cache (one-time clone of the real demo pack)"
WARM=$(mktemp -d)
( cd "$WARM" && \
  printf 'PROJECT_NAME="W"\nPROJECT_SLUG="w"\nPROJECT_TYPE="backend"\nDOMAIN="d"\nSTACK="s"\nAPI_STYLE="a"\nTESTING="t"\n' > w.config && \
  specgate init --config ./w.config --out . --no-git >/dev/null 2>&1 && \
  cd w && \
  specgate specops add --pack-repo "$SPECGATE_PACK_REPO" --pack-version "$SPECGATE_PACK_V1" --pack "$SPECGATE_PACK_ID" \
    --cache-dir "$SPECGATE_CACHE_DIR" --var PROJECT_NAME=W --var PROJECT_SLUG=w --var DOMAIN=d >/dev/null )
rm -rf "$WARM"
printf '  cache: %s\n' "$SPECGATE_CACHE_DIR"

# ── 3. Record the demo with VHS ──────────────────────────────────────────────
step "Recording the 1080p demo with VHS"
( cd "$REPO_ROOT" && vhs "$DEMO_DIR/demo.tape" )
[ -f "$OUT_DIR/demo.mp4" ] || die "VHS did not produce out/demo.mp4"
printf '  silent demo : %s\n' "$OUT_DIR/demo.mp4"
printf '  shareable   : %s\n' "$OUT_DIR/demo.gif"

# ── 4. Optional AI voice-over ────────────────────────────────────────────────
if [ -z "${OPENAI_API_KEY:-}" ]; then
  warn "OPENAI_API_KEY not set — skipping voice-over. Silent 1080p demo is ready."
  exit 0
fi
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  warn "ffmpeg / jq / curl missing — skipping voice-over."
  exit 0
fi

step "Synthesising voice-over from narration.json (OpenAI TTS)"
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
    die "OpenAI TTS error for segment '$ID': $(cat "$AUDIO_DIR/$i.mp3")"
  fi
  echo "file '$AUDIO_DIR/$i.mp3'"   >> "$CONCAT_LIST"
  echo "file '$AUDIO_DIR/gap.mp3'"  >> "$CONCAT_LIST"
done

step "Muxing voice-over onto the demo video"
ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" -c copy "$AUDIO_DIR/voice.mp3" >/dev/null 2>&1
ffmpeg -y -i "$OUT_DIR/demo.mp4" -i "$AUDIO_DIR/voice.mp3" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k \
  "$OUT_DIR/demo-narrated.mp4" >/dev/null 2>&1
printf '  narrated    : %s\n' "$OUT_DIR/demo-narrated.mp4"
step "Done."
