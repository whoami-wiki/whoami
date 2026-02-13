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
TAG="cli-v${VERSION}"

echo ""
echo "  Releasing ${TAG}..."
echo ""

# ── Generate release notes ────────────────────────────────────────────

PREV_TAG=$(git tag --list 'cli-v*' --sort=-version:refname | head -1)
NOTES_FILE="RELEASE_NOTES.md"

{
  # Collect commits since last CLI tag, scoped to cli/
  FEATS=""
  FIXES=""
  OTHER=""

  while IFS= read -r line; do
    case "$line" in
      feat:*|feat\(*) FEATS="${FEATS}
- ${line#feat: }" ;;
      fix:*|fix\(*)   FIXES="${FIXES}
- ${line#fix: }" ;;
      release:*|"")   ;;
      *)              OTHER="${OTHER}
- ${line}" ;;
    esac
  done <<EOF
$(git log "${PREV_TAG}..HEAD" --pretty=format:'%s' -- . ../cli/)
EOF

  if [ -n "$FEATS" ]; then
    printf '### Features\n%s\n\n' "$FEATS"
  fi
  if [ -n "$FIXES" ]; then
    printf '### Fixes\n%s\n\n' "$FIXES"
  fi
  if [ -n "$OTHER" ]; then
    printf '### Other\n%s\n\n' "$OTHER"
  fi

  echo "**Full Changelog**: https://github.com/whoami-wiki/whoami/compare/${PREV_TAG}...${TAG}"
} > "$NOTES_FILE"

echo "  Generated release notes:"
echo ""
cat "$NOTES_FILE"
echo ""

# ── Bump version ───────────────────────────────────────────────────────

# package.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json

# src/index.ts
sed -i '' "s/const VERSION = '.*'/const VERSION = '${VERSION}'/" src/index.ts

# ── Commit & tag ───────────────────────────────────────────────────────

git add package.json src/index.ts "$NOTES_FILE"
git commit -m "release: ${TAG}"
git tag "$TAG"
git push
git push origin "$TAG"

echo ""
echo "  Pushed ${TAG} — GitHub Actions will publish the release."
echo ""
