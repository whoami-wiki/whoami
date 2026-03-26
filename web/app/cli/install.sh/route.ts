const REPO = "whoami-wiki/whoami";

const script = `#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO}"
INSTALL_DIR="\${WAI_INSTALL_DIR:-\$HOME/.local/bin}"

# ── Helpers ───────────────────────────────────────────────────────────────

info()  { printf '  %s\\n' "\$@"; }
error() { printf '\\033[0;31merror:\\033[0m %s\\n' "\$@" >&2; exit 1; }

need() {
  command -v "\$1" > /dev/null 2>&1 || error "\$1 is required but not installed."
}

# ── Preflight ─────────────────────────────────────────────────────────────

need curl
need tar
need node

# ── Resolve latest version ────────────────────────────────────────────────

info "Fetching latest release..."
RELEASE_JSON=\$(curl -fsSL "https://api.github.com/repos/\$REPO/releases" \\
  -H "Accept: application/vnd.github.v3+json")

VERSION=\$(printf '%s' "\$RELEASE_JSON" | \\
  grep -o '"tag_name":\\s*"cli-v[^"]*"' | \\
  head -1 | \\
  sed 's/.*"cli-v\\([^"]*\\)".*/\\1/')

if [ -z "\$VERSION" ]; then
  error "Could not determine latest CLI version."
fi

info "Installing wai v\$VERSION..."

# ── Download & verify ─────────────────────────────────────────────────────

TARBALL="wai-v\${VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/\$REPO/releases/download/cli-v\${VERSION}/\${TARBALL}"
CHECKSUM_URL="\${DOWNLOAD_URL}.sha256"

TMP_DIR=\$(mktemp -d)
trap 'rm -rf "\$TMP_DIR"' EXIT

curl -fsSL "\$DOWNLOAD_URL" -o "\$TMP_DIR/\$TARBALL"
curl -fsSL "\$CHECKSUM_URL" -o "\$TMP_DIR/\$TARBALL.sha256"

# Verify checksum
EXPECTED=\$(awk '{print \$1}' "\$TMP_DIR/\$TARBALL.sha256")
if command -v shasum > /dev/null 2>&1; then
  ACTUAL=\$(shasum -a 256 "\$TMP_DIR/\$TARBALL" | awk '{print \$1}')
elif command -v sha256sum > /dev/null 2>&1; then
  ACTUAL=\$(sha256sum "\$TMP_DIR/\$TARBALL" | awk '{print \$1}')
else
  ACTUAL="\$EXPECTED" # skip verification if no tool available
fi

if [ "\$ACTUAL" != "\$EXPECTED" ]; then
  error "Checksum mismatch (expected \$EXPECTED, got \$ACTUAL)."
fi

# ── Install ───────────────────────────────────────────────────────────────

tar -xzf "\$TMP_DIR/\$TARBALL" -C "\$TMP_DIR"

mkdir -p "\$INSTALL_DIR"
cp "\$TMP_DIR/wai-v\${VERSION}/bin/wai" "\$INSTALL_DIR/wai"
chmod +x "\$INSTALL_DIR/wai"

info "Installed wai to \$INSTALL_DIR/wai"

# ── PATH check ────────────────────────────────────────────────────────────

case ":\$PATH:" in
  *":\$INSTALL_DIR:"*) ;;
  *)
    SHELL_NAME=\$(basename "\$SHELL")
    case "\$SHELL_NAME" in
      zsh)  RC="\$HOME/.zshrc" ;;
      bash) RC="\$HOME/.bashrc" ;;
      fish) RC="" ;;
      *)    RC="" ;;
    esac

    if [ -n "\$RC" ]; then
      echo "export PATH=\\"\$INSTALL_DIR:\\\$PATH\\"" >> "\$RC"
      info "Added \$INSTALL_DIR to your PATH in \$RC."
      info "Restart your terminal to apply."
    elif [ "\$SHELL_NAME" = "fish" ]; then
      fish_add_path \$INSTALL_DIR
      info "Added \$INSTALL_DIR to your PATH."
    else
      info "Add \$INSTALL_DIR to your PATH manually:"
      info "  export PATH=\\"\$INSTALL_DIR:\\\$PATH\\""
    fi
    ;;
esac

info "Installation complete."
`;

export function GET() {
  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
