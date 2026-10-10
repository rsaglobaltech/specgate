#!/usr/bin/env bash
#
# build.sh — record the day-to-day tutorial from an empty directory, with the
# published npm package, in two formats:
#   out/specgate-tutorial-16x9.mp4   1920×1080  (YouTube, LinkedIn)
#   out/specgate-tutorial-9x16.mp4   1080×1920  (Shorts, Reels, TikTok)
# (and a .gif of each)
#
# Required: vhs (brew install vhs), node ≥ 22, npm, git, vim
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$HERE/out"
command -v vhs >/dev/null || { echo "vhs not found: brew install vhs" >&2; exit 1; }

# Warm npm's cache so the install on camera takes a second, not a minute.
npm cache add @rsaglobaltech/specgate@latest >/dev/null 2>&1 || true

render() { # $1 name  $2 width  $3 height  $4 font size
  local work tape
  work="$(mktemp -d)"
  cat > "$work/.demo-env" <<ENV
mkdir -p "$work/proyectos" && cd "$work/proyectos"
export PS1='\[\e[1;36m\]\W\[\e[0m\] \$ '
export GIT_AUTHOR_NAME=demo GIT_AUTHOR_EMAIL=demo@specgate.dev
export GIT_COMMITTER_NAME=demo GIT_COMMITTER_EMAIL=demo@specgate.dev
export EDITOR=vim
ENV
  tape="$work/tutorial.tape"
  sed -e "s#__OUT__#$HERE/out/$1#" -e "s/__WIDTH__/$2/" -e "s/__HEIGHT__/$3/" \
    -e "s/__FONT__/$4/" "$HERE/tutorial.tape" > "$tape"
  echo "▶ $1 (${2}×${3})"
  DEMO_ENV="$work/.demo-env" vhs "$tape"
}

render specgate-tutorial-16x9 1920 1080 32
render specgate-tutorial-9x16 1080 1920 26
ls -la "$HERE/out"
