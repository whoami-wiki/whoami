#!/bin/bash
set -euo pipefail

# Build Lua 5.1 from source.
# Scribunto requires Lua 5.1 specifically (not 5.4).
#
# Output: resources/lua/bin/lua

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/resources/lua"

if [ -f "$OUT/bin/lua" ]; then
  echo "Lua binary already exists at $OUT/bin/lua — skipping"
  "$OUT/bin/lua" -v
  exit 0
fi

echo "==> Building Lua 5.1 from source..."

LUA_VERSION="5.1.5"
mkdir -p "$ROOT/.build"
LUA_TARBALL="$ROOT/.build/lua-$LUA_VERSION.tar.gz"

if [ ! -f "$LUA_TARBALL" ]; then
  curl -L -o "$LUA_TARBALL" "https://www.lua.org/ftp/lua-$LUA_VERSION.tar.gz"
fi

cd "$ROOT/.build"
rm -rf "lua-$LUA_VERSION"
tar xzf "$LUA_TARBALL"
cd "lua-$LUA_VERSION"

PLATFORM="macosx"
if [[ "$(uname)" == "Linux" ]]; then
  PLATFORM="linux"
fi

make "$PLATFORM" MYCFLAGS="-mmacosx-version-min=12.0"

mkdir -p "$OUT/bin"
cp src/lua "$OUT/bin/lua"
chmod +x "$OUT/bin/lua"

echo "==> Lua $LUA_VERSION ready at $OUT/bin/lua"
"$OUT/bin/lua" -v
