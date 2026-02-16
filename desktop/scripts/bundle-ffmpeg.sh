#!/bin/bash
set -euo pipefail

# Get an ffmpeg binary for TimedMediaHandler.
#
# TimedMediaHandler uses ffmpeg for thumbnail generation and transcoding.
# It degrades gracefully without it (no thumbnails for video, no transcoding).
#
# Output: resources/ffmpeg/bin/ffmpeg

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/resources/ffmpeg"

if [ -f "$OUT/bin/ffmpeg" ]; then
  echo "ffmpeg binary already exists at $OUT/bin/ffmpeg — skipping"
  "$OUT/bin/ffmpeg" -version 2>/dev/null | head -1 || true
  exit 0
fi

mkdir -p "$OUT/bin"

# ── Strategy 1: Use Homebrew ffmpeg (local dev on macOS) ─────────────────

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

# ── Strategy 2: System ffmpeg ────────────────────────────────────────────

if command -v ffmpeg &>/dev/null; then
  SYSTEM_FFMPEG="$(command -v ffmpeg)"
  echo "==> Using system ffmpeg: $SYSTEM_FFMPEG"
  ln -sf "$SYSTEM_FFMPEG" "$OUT/bin/ffmpeg"
  echo "==> ffmpeg ready at $OUT/bin/ffmpeg (symlink → $SYSTEM_FFMPEG)"
  "$OUT/bin/ffmpeg" -version 2>/dev/null | head -1 || true
  exit 0
fi

# ── Strategy 3: Install via Homebrew ─────────────────────────────────────

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
