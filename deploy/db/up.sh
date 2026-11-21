#!/usr/bin/env bash
# Hirfati - starts MySQL on EC2 B, waits until it is healthy, then prints a short report.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "ERROR: .env is missing"; exit 1; }
set -a; . ./.env; set +a

docker compose up -d
echo "Waiting for MySQL (the first start imports schema.sql and seed.sql, about 1-2 minutes)..."
s=starting
for i in $(seq 1 60); do
  s=$(docker inspect -f '{{.State.Health.Status}}' hirfati-mysql 2>/dev/null || echo starting)
  [ "$s" = healthy ] && break
  sleep 5
done
echo "MySQL status: $s"
[ "$s" = healthy ] || { docker compose logs --tail 40; exit 1; }

echo "----- RESULT -----"
docker compose ps
echo "Tables and row counts:"
docker exec -e MYSQL_PWD="$MYSQL_PASSWORD" hirfati-mysql mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "
SELECT 'users' t, COUNT(*) n FROM users UNION ALL
SELECT 'services', COUNT(*) FROM services UNION ALL
SELECT 'craftsman_profiles', COUNT(*) FROM craftsman_profiles UNION ALL
SELECT 'requests', COUNT(*) FROM requests UNION ALL
SELECT 'offers', COUNT(*) FROM offers UNION ALL
SELECT 'reviews', COUNT(*) FROM reviews UNION ALL
SELECT 'complaints', COUNT(*) FROM complaints UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions;"
echo "Monitor user grants:"
docker exec -e MYSQL_PWD="$MONITOR_PASSWORD" hirfati-mysql mysql -u"$MONITOR_USER" -e "SHOW GRANTS;"
echo "MySQL data on the EBS volume:"
sudo du -sh /data/mysql
