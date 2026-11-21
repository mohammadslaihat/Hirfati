#!/usr/bin/env bash
# Hirfati - restores a backup from S3 and compares row counts with the live database.
# Usage: sudo ./restore.sh [file-name|latest] [target_db]
#   target_db defaults to hirfati_restore_test (safe test, live data is not touched).
#   For a real recovery use: sudo ./restore.sh latest hirfati_db
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a
: "${BACKUP_BUCKET:?BACKUP_BUCKET is missing in .env}"

FILE="${1:-latest}"
TARGET="${2:-hirfati_restore_test}"
DIR=/data/restore
mkdir -p "$DIR"
AWS="docker run --rm --network host -v $DIR:/restore amazon/aws-cli"
MYSQL="docker exec -i -e MYSQL_PWD=$MYSQL_ROOT_PASSWORD hirfati-mysql mysql -uroot"

if [ "$FILE" = latest ]; then
  FILE=$($AWS s3 ls "s3://$BACKUP_BUCKET/mysql/" | awk '{print $4}' | sort | tail -1)
fi
[ -n "$FILE" ] || { echo "ERROR: no backups found in S3"; exit 1; }

echo "Restoring $FILE from S3 into database $TARGET ..."
$AWS s3 cp "s3://$BACKUP_BUCKET/mysql/$FILE" "/restore/$FILE" --only-show-errors
$MYSQL -e "CREATE DATABASE IF NOT EXISTS \`$TARGET\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gunzip -c "$DIR/$FILE" | $MYSQL "$TARGET"
rm -f "$DIR/$FILE"

echo "----- RESULT: $TARGET (restored) vs $MYSQL_DATABASE (live) -----"
for t in users services craftsman_profiles craftsman_services requests offers reviews complaints subscriptions; do
  a=$($MYSQL -N -e "SELECT COUNT(*) FROM \`$TARGET\`.$t")
  b=$($MYSQL -N -e "SELECT COUNT(*) FROM \`$MYSQL_DATABASE\`.$t")
  if [ "$a" = "$b" ]; then s=OK; else s=DIFF; fi
  printf "%-20s restored=%-6s live=%-6s %s\n" "$t" "$a" "$b" "$s"
done
