#!/usr/bin/env bash
# Hirfati - MySQL backup on EC2 B: mysqldump -> gzip -> /data/backups -> S3
# Runs from cron (see hirfati-backup.cron). Needs BACKUP_BUCKET in .env
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a
: "${BACKUP_BUCKET:?BACKUP_BUCKET is missing in .env}"

DIR=/data/backups
FILE="hirfati_db_$(date +%Y-%m-%d_%H-%M).sql.gz"
mkdir -p "$DIR"

# Consistent dump without locking tables (InnoDB)
docker exec -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" hirfati-mysql \
  mysqldump -uroot --single-transaction --routines --triggers "$MYSQL_DATABASE" \
  | gzip > "$DIR/$FILE"
gzip -t "$DIR/$FILE"

# Upload to S3 using the server's LabInstanceProfile permissions
docker run --rm --network host -v "$DIR:/backups:ro" amazon/aws-cli \
  s3 cp "/backups/$FILE" "s3://$BACKUP_BUCKET/mysql/$FILE" --only-show-errors

# Keep local copies for 7 days (S3 keeps them for 30 days)
find "$DIR" -name 'hirfati_db_*.sql.gz' -mtime +7 -delete

echo "$(date '+%F %T') OK $FILE $(du -h "$DIR/$FILE" | cut -f1) -> s3://$BACKUP_BUCKET/mysql/$FILE"
