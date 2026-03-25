#!/bin/bash
set -euo pipefail

# Get a PHP binary with extensions needed for MediaWiki.
#
# Usage:
#   bash build-php.sh           # Dev: symlink to Homebrew PHP
#   bash build-php.sh --static  # Dist: compile a static binary via static-php-cli
#
# Output: resources/php/bin/php

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/resources/php"

STATIC=false
TARGET_ARCH=""
for arg in "$@"; do
  case "$arg" in
    --static) STATIC=true ;;
    --arch=*) TARGET_ARCH="${arg#--arch=}" ;;
  esac
done

if [ -f "$OUT/bin/php" ]; then
  # For --static, replace any symlink with a real binary
  if [ "$STATIC" = true ] && [ -L "$OUT/bin/php" ]; then
    echo "==> Removing dev symlink (need static binary for distribution)..."
    rm "$OUT/bin/php"
  else
    echo "PHP binary already exists at $OUT/bin/php — skipping"
    "$OUT/bin/php" -v
    exit 0
  fi
fi

mkdir -p "$OUT/bin"

# ── Static binary for distribution (macOS) ─────────────────────────────

if [ "$STATIC" = true ]; then
  # MediaWiki extensions + extensions that are default-on in normal PHP but
  # must be explicitly listed for static builds (filter, openssl, ctype, etc.)
  EXTENSIONS="sqlite3,pdo_sqlite,mbstring,xml,dom,simplexml,xmlwriter,xmlreader,gd,intl,curl,fileinfo,phar,filter,openssl,ctype,iconv,tokenizer,session,zlib"
  HOST_ARCH="$(uname -m)"

  # Map host arch to static-php-cli naming (for downloading spc binary)
  case "$HOST_ARCH" in
    arm64) SPC_HOST_ARCH="aarch64" ;;
    *)     SPC_HOST_ARCH="$HOST_ARCH" ;;
  esac

  # Resolve target architecture
  if [ -z "$TARGET_ARCH" ]; then
    TARGET_ARCH="$HOST_ARCH"
  fi
  case "$TARGET_ARCH" in
    x64|x86_64) SPC_TARGET_ARCH="x86_64" ;;
    arm64)      SPC_TARGET_ARCH="aarch64" ;;
    *)          SPC_TARGET_ARCH="$TARGET_ARCH" ;;
  esac

  CROSS_ARGS=""
  if [ "$SPC_HOST_ARCH" != "$SPC_TARGET_ARCH" ]; then
    CROSS_ARGS="--arch=$SPC_TARGET_ARCH"
  fi

  echo "==> Building static PHP for macOS ($SPC_TARGET_ARCH) with extensions: $EXTENSIONS"

  BUILD_DIR="$ROOT/.build/php-static"
  mkdir -p "$BUILD_DIR"

  # Download spc (static-php-cli) binary for host architecture
  SPC="$BUILD_DIR/spc"
  if [ ! -f "$SPC" ]; then
    TARBALL="$BUILD_DIR/spc-macos-$SPC_HOST_ARCH.tar.gz"
    echo "==> Downloading static-php-cli..."
    curl -fSL -o "$TARBALL" \
      "https://github.com/crazywhalecc/static-php-cli/releases/latest/download/spc-macos-$SPC_HOST_ARCH.tar.gz"
    tar -xzf "$TARBALL" -C "$BUILD_DIR"
    chmod +x "$SPC"
    rm "$TARBALL"
  fi

  # Ensure build dependencies are available (spc doctor checks and fixes them)
  echo "==> Checking build dependencies..."
  "$SPC" doctor --auto-fix

  # Download PHP sources and extension dependencies
  echo "==> Downloading PHP 8.3 sources..."
  "$SPC" download --with-php=8.3 --for-extensions="$EXTENSIONS" --prefer-pre-built $CROSS_ARGS

  # Build static PHP CLI
  echo "==> Compiling static PHP CLI..."
  "$SPC" build "$EXTENSIONS" --build-cli $CROSS_ARGS

  # Copy the resulting binary
  cp buildroot/bin/php "$OUT/bin/php"
  chmod +x "$OUT/bin/php"

  echo "==> Static PHP ready at $OUT/bin/php"
  file "$OUT/bin/php"
  exit 0
fi

# ── Dev mode: symlink to Homebrew/system PHP ───────────────────────────

# Strategy 1: Use Homebrew PHP (local dev on macOS)
if command -v brew &>/dev/null; then
  # Try php 8.3 first, then any php
  for formula in php@8.3 php; do
    PHP_PATH="$(brew --prefix "$formula" 2>/dev/null)/bin/php" || continue
    if [ -f "$PHP_PATH" ]; then
      echo "==> Using Homebrew PHP: $PHP_PATH"

      # Verify required extensions
      MISSING=""
      for ext in sqlite3 pdo_sqlite mbstring xml gd intl curl fileinfo; do
        if ! "$PHP_PATH" -m 2>/dev/null | grep -qi "^$ext$"; then
          MISSING="$MISSING $ext"
        fi
      done

      if [ -n "$MISSING" ]; then
        echo "Warning: Missing extensions:$MISSING"
        echo "Trying next option..."
        continue
      fi

      # Symlink rather than copy — stays up to date with brew upgrades
      ln -sf "$PHP_PATH" "$OUT/bin/php"
      echo "==> PHP ready at $OUT/bin/php (symlink → $PHP_PATH)"
      "$OUT/bin/php" -v
      exit 0
    fi
  done
fi

# Strategy 2: System PHP
if command -v php &>/dev/null; then
  SYSTEM_PHP="$(command -v php)"
  PHP_VERSION="$(php -r 'echo PHP_MAJOR_VERSION;' 2>/dev/null)"
  if [ "$PHP_VERSION" -ge 8 ] 2>/dev/null; then
    echo "==> Using system PHP: $SYSTEM_PHP"
    ln -sf "$SYSTEM_PHP" "$OUT/bin/php"
    echo "==> PHP ready at $OUT/bin/php (symlink → $SYSTEM_PHP)"
    "$OUT/bin/php" -v
    exit 0
  else
    echo "System PHP is version $PHP_VERSION (need 8+), skipping"
  fi
fi

# Strategy 3: Install via Homebrew
if command -v brew &>/dev/null; then
  echo "==> No PHP found. Installing via Homebrew..."
  brew install php
  PHP_PATH="$(brew --prefix php)/bin/php"
  if [ -f "$PHP_PATH" ]; then
    ln -sf "$PHP_PATH" "$OUT/bin/php"
    echo "==> PHP ready at $OUT/bin/php (symlink → $PHP_PATH)"
    "$OUT/bin/php" -v
    exit 0
  fi
fi

echo "ERROR: Could not find or install PHP 8+."
echo "Install it manually: brew install php"
exit 1
