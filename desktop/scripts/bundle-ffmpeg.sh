#!/bin/bash
set -euo pipefail

# Get an ffmpeg binary for TimedMediaHandler.
#
# TimedMediaHandler uses ffmpeg for thumbnail generation and transcoding.
# It degrades gracefully without it (no thumbnails for video, no transcoding).
#
# Usage:
#   bash bundle-ffmpeg.sh           # Dev: symlink to system/Homebrew ffmpeg
#   bash bundle-ffmpeg.sh --static  # Dist: download a static macOS binary
#
# Output: resources/ffmpeg/bin/ffmpeg

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/resources/ffmpeg"

STATIC=false
for arg in "$@"; do
  case "$arg" in
    --static) STATIC=true ;;
  esac
done

if [ -f "$OUT/bin/ffmpeg" ]; then
  # For --static, replace any symlink with a real binary
  if [ "$STATIC" = true ] && [ -L "$OUT/bin/ffmpeg" ]; then
    echo "==> Removing dev symlink (need static binary for distribution)..."
    rm "$OUT/bin/ffmpeg"
  else
    echo "ffmpeg binary already exists at $OUT/bin/ffmpeg — skipping"
    "$OUT/bin/ffmpeg" -version 2>/dev/null | head -1 || true
    exit 0
  fi
fi

mkdir -p "$OUT/bin"

# ── Static binary for distribution (macOS) ───────────────────────────────

if [ "$STATIC" = true ]; then
  ARCH="$(uname -m)"
  echo "==> Downloading static ffmpeg for macOS ($ARCH)..."

  mkdir -p "$ROOT/.build"
  ZIPFILE="$ROOT/.build/ffmpeg-static-$ARCH.zip"

  if [ ! -f "$ZIPFILE" ]; then
    # evermeet.cx provides static macOS builds (widely used, linked from ffmpeg.org)
    curl -L -o "$ZIPFILE" "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip"
  fi

  TMPDIR="$(mktemp -d)"
  unzip -o "$ZIPFILE" -d "$TMPDIR"
  mv "$TMPDIR/ffmpeg" "$OUT/bin/ffmpeg"
  chmod +x "$OUT/bin/ffmpeg"
  rm -rf "$TMPDIR"

  echo "==> Static ffmpeg ready at $OUT/bin/ffmpeg"
  "$OUT/bin/ffmpeg" -version 2>/dev/null | head -1 || true
  exit 0
fi

# ── Dev mode: symlink to system ffmpeg ───────────────────────────────────

# Strategy 1: Homebrew ffmpeg
if command -v brew &>/dev/null; then
  FFMPEG_PATH="$(brew --prefix ffmpeg 2>/dev/null)/bin/ffmpeg" || true
  if [ -f "$FFMPEG_PATH" ]; then
    echo "==> Using Homebrew ffmpeg: $FFMPEG_PATH"
    ln -sf "$FFMPEG_PATH" "$OUT/bin/ffmpeg"
    echo "==> ffmpeg ready at $OUT/bin/ffmpeg (symlink → $FFMPEG_PATH)"
    "$OUT/bin/ffmpeg" -version 2>/dev/null | head -1 || true
    exit 0
  fi
fi

# Strategy 2: System ffmpeg
if command -v ffmpeg &>/dev/null; then
  SYSTEM_FFMPEG="$(command -v ffmpeg)"
  echo "==> Using system ffmpeg: $SYSTEM_FFMPEG"
  ln -sf "$SYSTEM_FFMPEG" "$OUT/bin/ffmpeg"
  echo "==> ffmpeg ready at $OUT/bin/ffmpeg (symlink → $SYSTEM_FFMPEG)"
  "$OUT/bin/ffmpeg" -version 2>/dev/null | head -1 || true
  exit 0
fi

# Strategy 3: Install via Homebrew
if command -v brew &>/dev/null; then
  echo "==> No ffmpeg found. Installing via Homebrew..."
  brew install ffmpeg
  FFMPEG_PATH="$(brew --prefix ffmpeg)/bin/ffmpeg"
  if [ -f "$FFMPEG_PATH" ]; then
    ln -sf "$FFMPEG_PATH" "$OUT/bin/ffmpeg"
    echo "==> ffmpeg ready at $OUT/bin/ffmpeg (symlink → $FFMPEG_PATH)"
    "$OUT/bin/ffmpeg" -version 2>/dev/null | head -1 || true
    exit 0
  fi
fi

echo "WARNING: Could not find or install ffmpeg."
echo "TimedMediaHandler will work without it but won't generate video thumbnails."
echo "Install it manually: brew install ffmpeg"
# Clean up the empty directory so next run retries
rm -rf "$OUT"
exit 0
