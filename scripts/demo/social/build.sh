#!/usr/bin/env bash
#
# build.sh — render the vertical social-media demo (console only, Spanish).
#
# Builds the CLI from this checkout, prepares a throwaway Node project that is
# already adopted (init runs off camera), and records demo.tape with VHS.
#
# Required: vhs (brew install vhs), node ≥ 22, git, python3
# Output:   scripts/demo/social/out/specgate-social.{mp4,gif}
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
WORK="$(mktemp -d)/tienda"
mkdir -p "$HERE/out" "$WORK/src" "$WORK/test"

command -v vhs >/dev/null || { echo "vhs not found: brew install vhs" >&2; exit 1; }

echo "▶ build the CLI from this checkout"
(cd "$ROOT" && npm run build --silent)
SPECGATE="node $ROOT/bin/specgate.js"

echo "▶ prepare an adopted project in $WORK"
cd "$WORK"
git init -q
printf '{"name":"tienda","version":"1.0.0","scripts":{"test":"node --test"}}\n' > package.json
echo 'module.exports = {};' > src/carrito.js
$SPECGATE init --no-capabilities >/dev/null 2>&1
$SPECGATE harness init >/dev/null 2>&1        # test_cmd: npm test, so done and check run it
$SPECGATE "done" REQ-001 >/dev/null 2>&1 || true
git add -A && git -c user.email=demo@specgate.dev -c user.name=demo commit -qm "adopted"

cat > "$WORK/.demo-env" <<ENV
cd "$WORK"
export PS1='\[\e[1;36m\]tienda\[\e[0m\] \$ '
export FILES="$HERE/files"
specgate() { $SPECGATE "\$@"; }
ENV

echo "▶ record"
cd "$ROOT"
DEMO_ENV="$WORK/.demo-env" vhs "$HERE/demo.tape"
ls -la "$HERE/out"
