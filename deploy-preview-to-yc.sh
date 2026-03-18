#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${YC_PUBLIC_BASE_URL:-}"
TIMESTAMP="$(date -u +"%Y%m%d-%H%M%S")"
RANDOM_SUFFIX="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(4))
PY
)"
PREVIEW_SLUG="${1:-preview-${TIMESTAMP}-${RANDOM_SUFFIX}}"
STAGING_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${STAGING_DIR}"
}

trap cleanup EXIT

case "${PREVIEW_SLUG}" in
  ""|*/*|.*)
    echo "Preview slug must be a simple folder name without slashes."
    exit 1
    ;;
esac

copy_if_exists() {
  local src_name="$1"

  if [[ -f "${ROOT_DIR}/${src_name}" ]]; then
    cp "${ROOT_DIR}/${src_name}" "${STAGING_DIR}/${src_name}"
  fi
}

copy_if_exists "index.html"
copy_if_exists "error.html"
copy_if_exists "styles.css"
copy_if_exists "robots.txt"
copy_if_exists "sitemap.xml"
copy_if_exists "llms.txt"
copy_if_exists "llms-full.txt"
copy_if_exists "yandex_9dadfe5176d566da.html"
cp -R "${ROOT_DIR}/assets" "${STAGING_DIR}/assets"

PREVIEW_URL=""
if [[ -n "${BASE_URL}" ]]; then
  PREVIEW_URL="${BASE_URL%/}/${PREVIEW_SLUG}/"
fi

python3 - "${STAGING_DIR}" "${PREVIEW_URL}" <<'PY'
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
preview_url = sys.argv[2]
robots_meta = '<meta name="robots" content="noindex, nofollow, noarchive">'
viewport_meta = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'

for html_path in root.glob("*.html"):
    text = html_path.read_text(encoding="utf-8")

    if 'meta name="robots"' in text:
        text = re.sub(r'<meta name="robots"[^>]*>', robots_meta, text, count=1)
    elif viewport_meta in text:
        text = text.replace(viewport_meta, f"{viewport_meta}\n  {robots_meta}", 1)
    else:
        text = text.replace("<head>", f"<head>\n  {robots_meta}", 1)

    if preview_url:
        page_url = preview_url if html_path.name == "index.html" else f"{preview_url}{html_path.name}"

        if 'rel="canonical"' in text:
            text = re.sub(
                r'<link rel="canonical" href="[^"]*">',
                f'<link rel="canonical" href="{page_url}">',
                text,
                count=1,
            )

        if 'property="og:url"' in text:
            text = re.sub(
                r'<meta property="og:url" content="[^"]*">',
                f'<meta property="og:url" content="{page_url}">',
                text,
                count=1,
            )

    html_path.write_text(text, encoding="utf-8")
PY

export DEPLOY_SOURCE_DIR="${STAGING_DIR}"
export YC_BUCKET_PREFIX="${PREVIEW_SLUG}"

echo "Deploying preview to secret prefix: ${PREVIEW_SLUG}/"
"${ROOT_DIR}/deploy-to-yc.sh"

if [[ -n "${PREVIEW_URL}" ]]; then
  echo "Preview URL: ${PREVIEW_URL}"
else
  echo "Preview prefix uploaded: ${PREVIEW_SLUG}/"
fi
