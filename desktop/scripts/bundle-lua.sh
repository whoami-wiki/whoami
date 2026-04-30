#!/bin/bash
set -euo pipefail

# Build LuaJIT 2.1 from source.
#
# LuaJIT is a Lua 5.1-compatible JIT runtime — same calling conventions as
# vanilla Lua 5.1 (which is what Scribunto requires) but actively maintained
# and 5-20× faster on Scribunto workloads. This is what Wikipedia itself
# runs for Scribunto.
#
# Output: resources/lua/bin/lua
#
# The binary is named `lua` (not `luajit`) so Scribunto's
# $wgScribuntoEngineConf['luastandalone']['luaPath'] = "$resources/lua/bin/lua"
# finds it without any config change.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/resources/lua"

TARGET_ARCH=""
for arg in "$@"; do
  case "$arg" in
    --arch=*) TARGET_ARCH="${arg#--arch=}" ;;
  esac
done

if [ -f "$OUT/bin/lua" ]; then
  echo "Lua binary already exists at $OUT/bin/lua — skipping"
  "$OUT/bin/lua" -v 2>/dev/null || file "$OUT/bin/lua"
  exit 0
fi

# LuaJIT 2.1 is a rolling release branch — no semver tags. Pin to the branch
# tip; switch to a specific commit hash here if you need bit-exact reproducibility.
LUAJIT_REF="v2.1"
mkdir -p "$ROOT/.build"
SRC_DIR="$ROOT/.build/LuaJIT"

if [ ! -d "$SRC_DIR/.git" ]; then
  echo "==> Cloning LuaJIT $LUAJIT_REF..."
  rm -rf "$SRC_DIR"
  git clone --depth 1 --branch "$LUAJIT_REF" https://github.com/LuaJIT/LuaJIT.git "$SRC_DIR"
fi

echo "==> Building LuaJIT $LUAJIT_REF (amalgamated)..."
cd "$SRC_DIR"

# macOS deployment target — match the rest of the bundle (php / lua / ffmpeg)
export MACOSX_DEPLOYMENT_TARGET=12.0

case "$TARGET_ARCH" in
  x64|x86_64)
    make clean
    make TARGET_FLAGS="-arch x86_64" amalg
    ;;
  arm64|aarch64)
    make clean
    make TARGET_FLAGS="-arch arm64" amalg
    ;;
  *)
    make clean
    make amalg
    ;;
esac

mkdir -p "$OUT/bin"
cp src/luajit "$OUT/bin/lua"
chmod +x "$OUT/bin/lua"

echo "==> LuaJIT ready at $OUT/bin/lua"
"$OUT/bin/lua" -v
file "$OUT/bin/lua"
