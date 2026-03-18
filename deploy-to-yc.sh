#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
SOURCE_DIR="${DEPLOY_SOURCE_DIR:-${ROOT_DIR}}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

set -a
. "${ENV_FILE}"
set +a

required_vars=(
  YC_BUCKET_NAME
  YC_ACCESS_KEY_ID
  YC_SECRET_ACCESS_KEY
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required variable: ${var_name}"
    exit 1
  fi
done

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is required. Install it first to use this deploy script."
  exit 1
fi

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "Missing deploy source directory: ${SOURCE_DIR}"
  exit 1
fi

if [[ ! -d "${SOURCE_DIR}/assets" ]]; then
  echo "Missing assets directory in deploy source: ${SOURCE_DIR}/assets"
  exit 1
fi

YC_REGION="${YC_REGION:-ru-central1}"
YC_S3_ENDPOINT="${YC_S3_ENDPOINT:-https://storage.yandexcloud.net}"
YC_BUCKET_PREFIX="${YC_BUCKET_PREFIX:-}"

if [[ -n "${YC_BUCKET_PREFIX}" && "${YC_BUCKET_PREFIX}" != */ ]]; then
  YC_BUCKET_PREFIX="${YC_BUCKET_PREFIX}/"
fi

export AWS_ACCESS_KEY_ID="${YC_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${YC_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="${YC_REGION}"

aws_s3() {
  aws --endpoint-url "${YC_S3_ENDPOINT}" s3 "$@"
}

upload_file() {
  local src="$1"
  local dst="$2"
  aws_s3 cp "${src}" "s3://${YC_BUCKET_NAME}/${YC_BUCKET_PREFIX}${dst}" --no-progress
}

upload_if_exists() {
  local src="$1"
  local dst="$2"

  if [[ -f "${src}" ]]; then
    upload_file "${src}" "${dst}"
  fi
}

echo "Uploading root files from ${SOURCE_DIR} to s3://${YC_BUCKET_NAME}/${YC_BUCKET_PREFIX}"
upload_file "${SOURCE_DIR}/index.html" "index.html"
upload_file "${SOURCE_DIR}/error.html" "error.html"
upload_if_exists "${SOURCE_DIR}/yandex_9dadfe5176d566da.html" "yandex_9dadfe5176d566da.html"
upload_file "${SOURCE_DIR}/styles.css" "styles.css"
upload_file "${SOURCE_DIR}/robots.txt" "robots.txt"
upload_file "${SOURCE_DIR}/sitemap.xml" "sitemap.xml"
upload_file "${SOURCE_DIR}/llms.txt" "llms.txt"
upload_file "${SOURCE_DIR}/llms-full.txt" "llms-full.txt"

echo "Syncing assets/"
aws_s3 sync "${SOURCE_DIR}/assets" "s3://${YC_BUCKET_NAME}/${YC_BUCKET_PREFIX}assets" --delete --no-progress

echo "Done."
