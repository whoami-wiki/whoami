#!/bin/bash
set -euo pipefail

# Download MediaWiki 1.43 + extensions into resources/mediawiki/
#
# Extensions: Cite, CiteThisPage, ParserFunctions, Scribunto,
#             TemplateData, TemplateStyles

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/resources/mediawiki"
MW_VERSION="1.43"
MW_FULL="1.43.0"

mkdir -p "$ROOT/.build"

# 1. Download + extract MediaWiki core
if [ -f "$OUT/index.php" ]; then
  echo "MediaWiki core already exists — skipping"
else
  echo "==> Downloading MediaWiki $MW_FULL..."
  TARBALL="$ROOT/.build/mediawiki-$MW_FULL.tar.gz"

  if [ ! -f "$TARBALL" ]; then
    curl -L -o "$TARBALL" \
      "https://releases.wikimedia.org/mediawiki/$MW_VERSION/mediawiki-$MW_FULL.tar.gz"
  fi

  echo "==> Extracting..."
  mkdir -p "$OUT"
  tar xzf "$TARBALL" --strip-components=1 -C "$OUT"
fi

# 2. Download extensions from ExtDist
# ExtDist URLs include a commit hash — we fetch the directory listing to resolve them.
EXTDIST_BASE="https://extdist.wmflabs.org/dist/extensions"
REL_TAG="REL${MW_VERSION//./_}"
EXTENSIONS="Cite CiteThisPage ParserFunctions Scribunto TemplateData TemplateStyles"

# Only fetch index if we need any extensions
NEED_EXTENSIONS=false
for ext in $EXTENSIONS; do
  if [ ! -d "$OUT/extensions/$ext" ]; then
    NEED_EXTENSIONS=true
    break
  fi
done

if [ "$NEED_EXTENSIONS" = true ]; then
  echo "==> Fetching extension index..."
  EXT_INDEX="$ROOT/.build/ext-index.html"
  curl -sL "$EXTDIST_BASE/" -o "$EXT_INDEX"

  for ext in $EXTENSIONS; do
    if [ -d "$OUT/extensions/$ext" ]; then
      echo "Extension $ext already exists — skipping"
      continue
    fi

    echo "==> Downloading extension: $ext"
    # Find the exact filename (e.g. Cite-REL1_43-918f705.tar.gz)
    EXT_FILE=$(grep -o "${ext}-${REL_TAG}-[a-f0-9]*\\.tar\\.gz" "$EXT_INDEX" | head -1)
    if [ -z "$EXT_FILE" ]; then
      echo "ERROR: Could not find $ext for $REL_TAG in ExtDist index"
      exit 1
    fi

    EXT_TARBALL="$ROOT/.build/${EXT_FILE}"
    if [ ! -f "$EXT_TARBALL" ]; then
      curl -L -o "$EXT_TARBALL" "$EXTDIST_BASE/$EXT_FILE"
    fi

    tar xzf "$EXT_TARBALL" -C "$OUT/extensions/"
  done
else
  echo "All extensions already exist — skipping"
fi

# 2b. Download TimedMediaHandler from GitHub (not on ExtDist for 1.43)
TMH_DIR="$OUT/extensions/TimedMediaHandler"
if [ ! -d "$TMH_DIR" ]; then
  echo "==> Downloading TimedMediaHandler (REL1_43 from GitHub)..."
  TMH_TARBALL="$ROOT/.build/TimedMediaHandler-REL1_43.tar.gz"
  if [ ! -f "$TMH_TARBALL" ]; then
    curl -L -o "$TMH_TARBALL" \
      "https://github.com/wikimedia/mediawiki-extensions-TimedMediaHandler/archive/refs/heads/REL1_43.tar.gz"
  fi
  mkdir -p "$TMH_DIR"
  tar xzf "$TMH_TARBALL" --strip-components=1 -C "$TMH_DIR"

  # Install composer dependencies
  COMPOSER_PHAR="$ROOT/.build/composer.phar"
  if [ ! -f "$COMPOSER_PHAR" ]; then
    echo "==> Downloading composer.phar..."
    curl -sS -o "$COMPOSER_PHAR" https://getcomposer.org/download/latest-stable/composer.phar
  fi

  PHP="$ROOT/resources/php/bin/php"
  if [ ! -f "$PHP" ]; then
    echo "ERROR: PHP must be built before bundling TimedMediaHandler (composer needs it)"
    exit 1
  fi

  echo "==> Installing TimedMediaHandler composer dependencies..."
  "$PHP" "$COMPOSER_PHAR" install --no-dev --no-interaction --working-dir="$TMH_DIR"
else
  echo "TimedMediaHandler already exists — skipping"
fi

# 3. Download Vector skin if missing
if [ ! -d "$OUT/skins/Vector" ]; then
  echo "==> Downloading Vector skin"
  SKIN_INDEX="$ROOT/.build/skin-index.html"
  curl -sL "https://extdist.wmflabs.org/dist/skins/" -o "$SKIN_INDEX"
  SKIN_FILE=$(grep -o "Vector-${REL_TAG}-[a-f0-9]*\\.tar\\.gz" "$SKIN_INDEX" | head -1)
  if [ -z "$SKIN_FILE" ]; then
    echo "ERROR: Could not find Vector skin for $REL_TAG"
    exit 1
  fi
  SKIN_TARBALL="$ROOT/.build/${SKIN_FILE}"
  if [ ! -f "$SKIN_TARBALL" ]; then
    curl -L -o "$SKIN_TARBALL" "https://extdist.wmflabs.org/dist/skins/$SKIN_FILE"
  fi
  tar xzf "$SKIN_TARBALL" -C "$OUT/skins/"
else
  echo "Vector skin already exists — skipping"
fi

# 4. Prune unused files to reduce bundle size
echo "==> Pruning unused extensions, skins, languages, and dev artifacts..."

# Keep only the extensions we use
KEEP_EXTENSIONS="Cite CiteThisPage ParserFunctions Scribunto TemplateData TemplateStyles TimedMediaHandler"
for dir in "$OUT"/extensions/*/; do
  ext="$(basename "$dir")"
  if ! echo "$KEEP_EXTENSIONS" | grep -qw "$ext"; then
    rm -rf "$dir"
  fi
done

# Keep only the Vector skin
for dir in "$OUT"/skins/*/; do
  skin="$(basename "$dir")"
  if [ "$skin" != "Vector" ]; then
    rm -rf "$dir"
  fi
done

# Prune languages — keep only en.json and qqq.json
find "$OUT/languages/i18n" -name '*.json' ! -name 'en.json' ! -name 'qqq.json' -delete
find "$OUT/languages/messages" -name '*.php' ! -name 'MessagesEn.php' -delete
for dir in "$OUT"/extensions/*/i18n "$OUT"/skins/*/i18n; do
  [ -d "$dir" ] && find "$dir" -name '*.json' ! -name 'en.json' ! -name 'qqq.json' -delete
done

# Delete docs, tests, and dev artifacts
rm -rf "$OUT/tests" "$OUT/docs"
for dir in "$OUT"/extensions/*/tests "$OUT"/skins/*/tests; do
  [ -d "$dir" ] && rm -rf "$dir"
done

# 5. Create router.php for PHP's built-in server
cat > "$OUT/router.php" << 'ROUTER'
<?php
/**
 * Router for PHP built-in web server.
 * Sets MW_CONFIG_FILE for all PHP requests, serves static assets directly.
 */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$filePath = __DIR__ . $path;

// Check data directory for uploaded files (images/, thumb/)
if ($path !== '/' && !is_file($filePath) && getenv('MW_DATA_PATH')) {
    $dataFilePath = getenv('MW_DATA_PATH') . $path;
    if (is_file($dataFilePath)) {
        $filePath = $dataFilePath;
    }
}

// Serve static (non-PHP) files directly
if ($path !== '/' && is_file($filePath)) {
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    if ($ext !== 'php') {
        $types = [
            'css' => 'text/css',
            'js' => 'application/javascript',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'ico' => 'image/x-icon',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'mp3' => 'audio/mpeg',
            'mp4' => 'video/mp4',
            'ogg' => 'audio/ogg',
            'ogv' => 'video/ogg',
            'opus' => 'audio/opus',
            'wav' => 'audio/wav',
            'webm' => 'video/webm',
            'flac' => 'audio/flac',
        ];
        if (isset($types[$ext])) {
            header('Content-Type: ' . $types[$ext]);
        }
        // Files outside the document root must be served manually;
        // return false only works for files under the document root.
        if (strpos($filePath, __DIR__) === 0) {
            return false;
        }
        readfile($filePath);
        return true;
    }
}

// Set LocalSettings path from user data directory for ALL PHP requests
if (getenv('MW_DATA_PATH')) {
    $localSettings = getenv('MW_DATA_PATH') . '/LocalSettings.php';
    if (file_exists($localSettings)) {
        define('MW_CONFIG_FILE', $localSettings);
    }
}

// Determine which PHP entry point to use
if ($path !== '/' && is_file($filePath) && pathinfo($filePath, PATHINFO_EXTENSION) === 'php') {
    $_SERVER['SCRIPT_NAME'] = $path;
    $_SERVER['SCRIPT_FILENAME'] = $filePath;
    require $filePath;
} else {
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/index.php';
    require __DIR__ . '/index.php';
}
ROUTER

echo "==> MediaWiki $MW_FULL ready at $OUT"
