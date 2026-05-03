# syntax=docker/dockerfile:1

FROM ghcr.io/linuxserver/baseimage-ubuntu:noble

# set version label
ARG BUILD_DATE
ARG VERSION
LABEL build_version="whoami.wiki version:- ${VERSION} Build-date:- ${BUILD_DATE}"
LABEL maintainer="whoami-wiki"

# environment settings
ARG DEBIAN_FRONTEND="noninteractive"
ENV HOME="/config"

RUN \
  echo "**** install PHP 8.3 and runtime dependencies ****" && \
  apt-get update && \
  apt-get install -y --no-install-recommends \
    php-cli \
    php-sqlite3 \
    php-mbstring \
    php-xml \
    php-gd \
    php-intl \
    php-curl \
    php-zip \
    ffmpeg \
    unzip && \
  echo "**** install Lua build dependencies ****" && \
  apt-get install -y --no-install-recommends \
    build-essential \
    libreadline-dev && \
  echo "**** build Lua 5.1 from source (Scribunto requires exactly 5.1) ****" && \
  curl -L -o /tmp/lua.tar.gz \
    "https://www.lua.org/ftp/lua-5.1.5.tar.gz" && \
  mkdir -p /tmp/lua-build && \
  tar xzf /tmp/lua.tar.gz -C /tmp/lua-build --strip-components=1 && \
  make -C /tmp/lua-build linux && \
  mkdir -p /app/lua/bin && \
  cp /tmp/lua-build/src/lua /app/lua/bin/lua && \
  chmod +x /app/lua/bin/lua && \
  echo "**** download MediaWiki 1.43 ****" && \
  mkdir -p /app/mediawiki && \
  curl -L -o /tmp/mediawiki.tar.gz \
    "https://releases.wikimedia.org/mediawiki/1.43/mediawiki-1.43.0.tar.gz" && \
  tar xzf /tmp/mediawiki.tar.gz --strip-components=1 -C /app/mediawiki && \
  echo "**** download MediaWiki extensions ****" && \
  curl -sL "https://extdist.wmflabs.org/dist/extensions/" -o /tmp/ext-index.html && \
  for ext in Cite CiteThisPage ParserFunctions Scribunto TemplateData TemplateStyles; do \
    EXT_FILE=$(grep -o "${ext}-REL1_43-[a-f0-9]*\\.tar\\.gz" /tmp/ext-index.html | head -1); \
    if [ -z "$EXT_FILE" ]; then echo "ERROR: Could not find extension $ext for REL1_43"; exit 1; fi; \
    echo "  -> $ext ($EXT_FILE)"; \
    curl -L -o "/tmp/${EXT_FILE}" "https://extdist.wmflabs.org/dist/extensions/${EXT_FILE}"; \
    tar xzf "/tmp/${EXT_FILE}" -C /app/mediawiki/extensions/; \
  done && \
  echo "**** download TimedMediaHandler ****" && \
  curl -L -o /tmp/tmh.tar.gz \
    "https://github.com/wikimedia/mediawiki-extensions-TimedMediaHandler/archive/refs/heads/REL1_43.tar.gz" && \
  mkdir -p /app/mediawiki/extensions/TimedMediaHandler && \
  tar xzf /tmp/tmh.tar.gz --strip-components=1 \
    -C /app/mediawiki/extensions/TimedMediaHandler && \
  curl -sS -o /tmp/composer.phar \
    https://getcomposer.org/download/latest-stable/composer.phar && \
  php /tmp/composer.phar install \
    --no-dev --no-interaction --ignore-platform-reqs \
    --working-dir=/app/mediawiki/extensions/TimedMediaHandler && \
  echo "**** download Vector skin ****" && \
  curl -sL "https://extdist.wmflabs.org/dist/skins/" -o /tmp/skin-index.html && \
  SKIN_FILE=$(grep -o "Vector-REL1_43-[a-f0-9]*\\.tar\\.gz" /tmp/skin-index.html | head -1) && \
  if [ -z "$SKIN_FILE" ]; then echo "ERROR: Could not find Vector skin for REL1_43"; exit 1; fi && \
  echo "  -> Vector ($SKIN_FILE)" && \
  curl -L -o "/tmp/${SKIN_FILE}" "https://extdist.wmflabs.org/dist/skins/${SKIN_FILE}" && \
  tar xzf "/tmp/${SKIN_FILE}" -C /app/mediawiki/skins/ && \
  echo "**** prune unused MediaWiki files ****" && \
  for dir in /app/mediawiki/extensions/*/; do \
    ext="$(basename "$dir")"; \
    echo "Cite CiteThisPage ParserFunctions Scribunto TemplateData TemplateStyles TimedMediaHandler" | \
      grep -qw "$ext" || rm -rf "$dir"; \
  done && \
  for dir in /app/mediawiki/skins/*/; do \
    skin="$(basename "$dir")"; \
    [ "$skin" != "Vector" ] && rm -rf "$dir" || true; \
  done && \
  find /app/mediawiki/languages/i18n -name '*.json' \
    ! -name 'en.json' ! -name 'qqq.json' -delete 2>/dev/null || true && \
  find /app/mediawiki/languages/messages -name '*.php' \
    ! -name 'MessagesEn.php' -delete 2>/dev/null || true && \
  for dir in /app/mediawiki/extensions/*/i18n /app/mediawiki/skins/*/i18n; do \
    [ -d "$dir" ] && find "$dir" -name '*.json' \
      ! -name 'en.json' ! -name 'qqq.json' -delete; \
  done && \
  rm -rf /app/mediawiki/extensions/Scribunto/includes/Engines/LuaStandalone/binaries && \
  rm -rf /app/mediawiki/tests /app/mediawiki/docs && \
  for dir in /app/mediawiki/extensions/*/tests /app/mediawiki/skins/*/tests; do \
    [ -d "$dir" ] && rm -rf "$dir"; \
  done && \
  echo "**** remove build dependencies ****" && \
  apt-get purge -y --auto-remove \
    build-essential \
    libreadline-dev && \
  echo "**** cleanup ****" && \
  apt-get clean && \
  rm -rf \
    /config/* \
    /tmp/* \
    /var/lib/apt/lists/* \
    /var/tmp/*

# copy router, templates, and local files
COPY docker/router.php /app/mediawiki/router.php
COPY desktop/resources/templates/ /app/templates/
COPY docker/root/ /

# ports and volumes
EXPOSE 8080
VOLUME /config
