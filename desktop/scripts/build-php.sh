#!/bin/bash
set -euo pipefail

# Get a PHP binary with extensions needed for MediaWiki.
#
# For local development: uses Homebrew PHP (php 8.x with needed extensions).
# For CI/release builds: uses static-php-cli to compile a static binary.
#
# Output: resources/php/bin/php

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/resources/php"

if [ -f "$OUT/bin/php" ]; then
  echo "PHP binary already exists at $OUT/bin/php — skipping"
  "$OUT/bin/php" -v
  exit 0
fi

mkdir -p "$OUT/bin"

# ── Strategy 1: Use Homebrew PHP (local dev on macOS) ────────────────────

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

# ── Strategy 2: System PHP ───────────────────────────────────────────────

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

# ── Strategy 3: Install via Homebrew ─────────────────────────────────────

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
