#!/bin/sh
set -e

cd "$(dirname "$0")/.."

# ── Guard: must be on main ─────────────────────────────────────────────

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "Must be on main to release (currently on ${BRANCH})." >&2
  exit 1
fi

# ── Get version ────────────────────────────────────────────────────────

VERSION="$1"

if [ -z "$VERSION" ]; then
  CURRENT=$(node -p "require('./package.json').version")
  echo "Current version: $CURRENT"
  printf "New version: "
  read -r VERSION
fi

if [ -z "$VERSION" ]; then
  echo "No version provided." >&2
  exit 1
fi

# Strip leading v if present
VERSION="${VERSION#v}"
TAG="desktop-v${VERSION}"

echo ""
echo "  Releasing ${TAG}..."
echo ""

# ── Bump version ───────────────────────────────────────────────────────

sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json

# ── Commit & tag ───────────────────────────────────────────────────────

git add package.json
git commit -m "release: ${TAG}"
git tag "$TAG"
git push
git push origin "$TAG"

echo ""
echo "  Pushed ${TAG} — GitHub Actions will publish the release."
echo ""
