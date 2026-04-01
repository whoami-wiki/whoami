#!/usr/bin/env bash
# Tests for CLI build output and binary correctness.
# This script validates that the built CLI artifact works as expected.
# It does NOT test the remote install.sh download flow (that requires network).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

echo "=== CLI Install / Build Tests ==="
echo ""

# ── Build the CLI ─────────────────────────────────────────────────────

echo "Building CLI..."
(cd "$CLI_DIR" && pnpm build) > /dev/null 2>&1

BUILT="$CLI_DIR/dist/wai.cjs"

# ── Test: built artifact exists ───────────────────────────────────────

echo ""
echo "Build output:"
if [ -f "$BUILT" ]; then
  pass "dist/wai.cjs exists"
else
  fail "dist/wai.cjs does not exist"
  echo ""
  echo "Results: $PASS passed, $FAIL failed"
  exit 1
fi

# ── Test: artifact is executable via node ─────────────────────────────

echo ""
echo "Binary behavior:"
VERSION_OUTPUT=$(node "$BUILT" --version 2>/dev/null || true)
if echo "$VERSION_OUTPUT" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  pass "--version prints semver ($VERSION_OUTPUT)"
else
  fail "--version output is not semver: '$VERSION_OUTPUT'"
fi

# ── Test: --help exits 0 and prints usage ─────────────────────────────

HELP_OUTPUT=$(node "$BUILT" --help 2>/dev/null || true)
if echo "$HELP_OUTPUT" | grep -q "Usage:"; then
  pass "--help prints usage information"
else
  fail "--help does not print usage"
fi

# ── Test: unknown command exits non-zero ──────────────────────────────

set +e
node "$BUILT" nonexistent 2>/dev/null
EXIT_CODE=$?
set -e
if [ "$EXIT_CODE" -ne 0 ]; then
  pass "unknown command exits with non-zero code ($EXIT_CODE)"
else
  fail "unknown command should exit non-zero"
fi

# ── Test: help lists expected commands ────────────────────────────────

echo ""
echo "Command coverage:"
EXPECTED_COMMANDS="read write edit create search upload auth update export import"
for cmd in $EXPECTED_COMMANDS; do
  if echo "$HELP_OUTPUT" | grep -q "$cmd"; then
    pass "help mentions '$cmd'"
  else
    fail "help does not mention '$cmd'"
  fi
done

# ── Test: version matches package.json ────────────────────────────────

echo ""
echo "Version consistency:"
PKG_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CLI_DIR/package.json','utf-8')).version)")
if [ "$VERSION_OUTPUT" = "$PKG_VERSION" ]; then
  pass "CLI version ($VERSION_OUTPUT) matches package.json ($PKG_VERSION)"
else
  fail "CLI version ($VERSION_OUTPUT) does not match package.json ($PKG_VERSION)"
fi

# ── Summary ───────────────────────────────────────────────────────────

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
