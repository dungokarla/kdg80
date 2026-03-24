#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
SOURCE_DIR="${DEPLOY_SOURCE_DIR:-${ROOT_DIR}}"
DEPLOY_MODE="${DEPLOY_MODE:-legacy-root}"

if [[ ! -f "${ENV_FILE}" ]]; then
  ENV_FILE="${ROOT_DIR}/docs/.env"
fi

if [[ "${DEPLOY_MODE}" == "legacy-root" && "${SOURCE_DIR}" != "${ROOT_DIR}" ]]; then
  DEPLOY_MODE="static-tree"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing .env file. Checked ${ROOT_DIR}/.env and ${ROOT_DIR}/docs/.env"
  exit 1
fi

OVERRIDE_YC_BUCKET_NAME="${YC_BUCKET_NAME-__UNSET__}"
OVERRIDE_YC_ACCESS_KEY_ID="${YC_ACCESS_KEY_ID-__UNSET__}"
OVERRIDE_YC_SECRET_ACCESS_KEY="${YC_SECRET_ACCESS_KEY-__UNSET__}"
OVERRIDE_YC_REGION="${YC_REGION-__UNSET__}"
OVERRIDE_YC_S3_ENDPOINT="${YC_S3_ENDPOINT-__UNSET__}"
OVERRIDE_YC_BUCKET_PREFIX="${YC_BUCKET_PREFIX-__UNSET__}"

set -a
. "${ENV_FILE}"
set +a

if [[ "${OVERRIDE_YC_BUCKET_NAME}" != "__UNSET__" ]]; then
  YC_BUCKET_NAME="${OVERRIDE_YC_BUCKET_NAME}"
fi
if [[ "${OVERRIDE_YC_ACCESS_KEY_ID}" != "__UNSET__" ]]; then
  YC_ACCESS_KEY_ID="${OVERRIDE_YC_ACCESS_KEY_ID}"
fi
if [[ "${OVERRIDE_YC_SECRET_ACCESS_KEY}" != "__UNSET__" ]]; then
  YC_SECRET_ACCESS_KEY="${OVERRIDE_YC_SECRET_ACCESS_KEY}"
fi
if [[ "${OVERRIDE_YC_REGION}" != "__UNSET__" ]]; then
  YC_REGION="${OVERRIDE_YC_REGION}"
fi
if [[ "${OVERRIDE_YC_S3_ENDPOINT}" != "__UNSET__" ]]; then
  YC_S3_ENDPOINT="${OVERRIDE_YC_S3_ENDPOINT}"
fi
if [[ "${OVERRIDE_YC_BUCKET_PREFIX}" != "__UNSET__" ]]; then
  YC_BUCKET_PREFIX="${OVERRIDE_YC_BUCKET_PREFIX}"
fi

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

copy_static_tree_without_listing() {
  local destination="s3://${YC_BUCKET_NAME}/${YC_BUCKET_PREFIX}"
  echo "Uploading static tree from ${SOURCE_DIR} to ${destination} without bucket listing"
  aws_s3 cp "${SOURCE_DIR}" "${destination}" --recursive --no-progress
}

sync_static_tree() {
  local destination="s3://${YC_BUCKET_NAME}/${YC_BUCKET_PREFIX}"
  local -a sync_args=(--no-progress --delete)

  if [[ -n "${YC_BUCKET_PREFIX}" ]]; then
    # Secret preview prefixes are unique per deploy, so they can be published with put-only
    # credentials and do not need bucket-wide list/delete permissions.
    copy_static_tree_without_listing
    return
  fi

  if [[ -z "${YC_BUCKET_PREFIX}" ]]; then
    sync_args+=(
      --exclude "tickets/*"
      --exclude "exports/*"
      --exclude "preview-*"
      --exclude "preview-*/*"
      --exclude "yandex_*.html"
      --exclude "robots.txt"
      --exclude "sitemap.xml"
      --exclude "llms.txt"
      --exclude "llms-full.txt"
    )
  fi

  echo "Syncing static tree from ${SOURCE_DIR} to ${destination}"
  aws_s3 sync "${SOURCE_DIR}" "${destination}" "${sync_args[@]}"
}

case "${DEPLOY_MODE}" in
  legacy-root)
    if [[ ! -d "${SOURCE_DIR}/assets" ]]; then
      echo "Missing assets directory in deploy source: ${SOURCE_DIR}/assets"
      exit 1
    fi
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
    ;;
  static-tree)
    if [[ ! -f "${SOURCE_DIR}/index.html" ]]; then
      echo "Static tree deploy expects index.html in ${SOURCE_DIR}"
      exit 1
    fi
    sync_static_tree
    ;;
  *)
    echo "Unknown DEPLOY_MODE: ${DEPLOY_MODE}"
    exit 1
    ;;
esac

echo "Done."
