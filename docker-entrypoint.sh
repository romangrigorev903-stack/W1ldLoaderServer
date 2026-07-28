#!/bin/sh
set -eu

if [ "${LITESTREAM_ENABLED:-true}" = "false" ]; then
    exec "$@"
fi

missing=""
for name in S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY; do
    value="$(printenv "$name" 2>/dev/null || true)"
    if [ -z "$value" ]; then
        missing="$missing $name"
    fi
done

if [ -n "$missing" ]; then
    echo "S3 is not fully configured; starting with local client storage.$missing" >&2
    exec "$@"
fi

export DB_PATH="${DB_PATH:-/data/w1ld_auth.db}"
export S3_DATABASE_PREFIX="${S3_DATABASE_PREFIX:-database/}"
export S3_FORCE_PATH_STYLE="${S3_FORCE_PATH_STYLE:-true}"

echo "Starting with S3 client storage and Litestream replication." >&2
exec litestream replicate -config /etc/litestream.yml
