#!/usr/bin/env bash
# Builds a cPanel-ready zip: upload it to public_html (File Manager → Upload → Extract) and open the site.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="$(tr -d '[:space:]' < VERSION)"
NAME="dynamic-documents-v${VERSION}-cpanel"
OUT="${1:-releases}"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$OUT" "$STAGE/storage"
# everything except dev-only / runtime files
tar --exclude='./.git' --exclude='./.github' --exclude='./releases' --exclude='./dist' \
    --exclude='./storage' --exclude='./tools' --exclude='./README.md' --exclude='./.gitignore' \
    --exclude='*.log' -cf - . | tar -xf - -C "$STAGE"
# empty, protected storage/
cp storage/.htaccess storage/index.html "$STAGE/storage/"

( cd "$STAGE" && rm -f "$OLDPWD/$OUT/$NAME.zip" && zip -qr "$OLDPWD/$OUT/$NAME.zip" . -x '*.DS_Store' )
echo "Built $OUT/$NAME.zip"
unzip -l "$OUT/$NAME.zip" | tail -1
